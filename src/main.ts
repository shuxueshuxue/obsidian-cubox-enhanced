import { Notice, Plugin, TFile, TFolder, normalizePath, requestUrl } from 'obsidian';
import path from 'path';
import { CuboxApi, CuboxArticle } from './cuboxApi';
import { CuboxDailySyncSettingTab, CuboxDailySyncSettings, DEFAULT_SETTINGS } from './cuboxSetting';
import { parseCuboxTime } from './utils';

export default class CuboxDailySyncPlugin extends Plugin {
	settings: CuboxDailySyncSettings;
	cuboxApi: CuboxApi;
	syncIntervalId: number | null = null;
	private readonly maxRecentIds = 200;

	async onload() {
		await this.loadSettings();

		this.cuboxApi = new CuboxApi(this.settings.domain, this.settings.apiKey);
		if (this.settings.syncing) {
			this.settings.syncing = false;
			await this.saveSettings();
		}

		if (!this.settings.lastSyncTime) {
			this.settings.lastSyncTime = Date.now();
			await this.saveSettings();
		}

		this.addCommand({
			id: 'sync-cubox-to-daily-note',
			name: 'Sync Cubox to daily note',
			callback: async () => {
				await this.syncCubox(true);
			},
		});

		this.addSettingTab(new CuboxDailySyncSettingTab(this.app, this));
		this.setupAutoSync();
	}

	onunload() {
		if (this.syncIntervalId) {
			window.clearInterval(this.syncIntervalId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	setupAutoSync() {
		if (this.syncIntervalId) {
			window.clearInterval(this.syncIntervalId);
		}

		if (this.settings.syncFrequencyMinutes > 0) {
			this.syncIntervalId = window.setInterval(
				async () => await this.syncCubox(false),
				this.settings.syncFrequencyMinutes * 60 * 1000
			);
			this.registerInterval(this.syncIntervalId);
		}
	}

	updateCuboxApiConfig(domain: string, apiKey: string) {
		this.cuboxApi.updateConfig(domain, apiKey);
	}

	private async syncCubox(verbose: boolean) {
		const log = (message: string, data?: Record<string, unknown>) => {
			if (!verbose) return;
			if (data) {
				console.log(message, data);
			} else {
				console.log(message);
			}
		};

		log('CuboxDailySync: manual sync started');
		if (this.settings.syncing) {
			log('CuboxDailySync: sync already running');
			return;
		}

		if (!this.settings.domain || !this.settings.apiKey) {
			log('CuboxDailySync: missing domain or API key');
			throw new Error('Cubox sync needs a domain and API key.');
		}

		this.settings.syncing = true;
		await this.saveSettings();

		try {
			const dailyNote = await this.getTodayDailyNote();
			log('CuboxDailySync: daily note ready', { path: dailyNote.path });
			const lastSyncTime = this.settings.lastSyncTime;
			log('CuboxDailySync: lastSyncTime', { lastSyncTime });
			let newestSyncTime = lastSyncTime;
			let lastCardId: string | null = this.settings.lastSyncCardId;
			let lastCardUpdateTime: string | null = this.settings.lastSyncCardUpdateTime;
			let hasMore = true;
			const recentIds = new Set(this.settings.recentSyncedIds);
			const entries: string[] = [];

			while (hasMore) {
				log('CuboxDailySync: requesting page', { lastCardId, lastCardUpdateTime });
				const response: { articles: CuboxArticle[]; hasMore: boolean } = await this.cuboxApi.getArticlesPage(
					lastCardId,
					lastCardUpdateTime
				);
				log('CuboxDailySync: page received', {
					count: response.articles.length,
					hasMore: response.hasMore,
				});
				const articles: CuboxArticle[] = response.articles;
				const moreArticles: boolean = response.hasMore;

				if (articles.length === 0) {
					break;
				}

				for (const article of articles) {
					const articleTime = this.getArticleTimestamp(article);
					if (articleTime <= lastSyncTime) {
						continue;
					}

					// @@@dedupe - avoid duplicate append when Cubox updates the same card after extraction.
					if (recentIds.has(article.id)) {
						continue;
					}

					try {
						const entry = await this.formatEntry(article);
						entries.push(entry);
						recentIds.add(article.id);
						if (articleTime > newestSyncTime) {
							newestSyncTime = articleTime;
						}
					} catch (error) {
						console.error('CuboxDailySync: entry skipped', { id: article.id, error });
					}
				}

				lastCardId = articles[articles.length - 1].id;
				lastCardUpdateTime = articles[articles.length - 1].update_time;
				hasMore = moreArticles;
			}

			if (entries.length > 0) {
				const payload = entries.join('\n\n');
				await this.appendToFile(dailyNote, payload);
			}
			log('CuboxDailySync: entries appended', { count: entries.length });

			if (lastCardId && lastCardUpdateTime) {
				this.settings.lastSyncCardId = lastCardId;
				this.settings.lastSyncCardUpdateTime = lastCardUpdateTime;
			}
			this.settings.recentSyncedIds = Array.from(recentIds).slice(-this.maxRecentIds);
			let finalSyncTime = lastSyncTime;
			if (lastCardUpdateTime) {
				finalSyncTime = parseCuboxTime(lastCardUpdateTime);
			} else if (entries.length > 0) {
				finalSyncTime = newestSyncTime;
			}
			this.settings.lastSyncTime = finalSyncTime;
			await this.saveSettings();

			if (entries.length > 0) {
				new Notice(`Cubox: added ${entries.length} new item(s) to today.`);
			}
		} catch (error) {
			console.error('CuboxDailySync: sync failed', error);
		} finally {
			this.settings.syncing = false;
			await this.saveSettings();
		}
	}

	private getArticleTimestamp(article: CuboxArticle): number {
		const sourceTime = article.update_time || article.create_time;
		if (!sourceTime) {
			throw new Error(`Cubox article ${article.id} is missing update_time.`);
		}
		return parseCuboxTime(sourceTime);
	}

	private isLinkArticle(article: CuboxArticle): boolean {
		return Boolean(article.url && article.url.trim());
	}

	private renderLinkTemplate(article: CuboxArticle): string {
		const template = this.settings.linkTemplate;
		if (!template.trim()) {
			throw new Error('Link template is empty.');
		}

		return template
			.split('{{title}}').join(article.title || '')
			.split('{{url}}').join(article.url || '');
	}

	private async formatEntry(article: CuboxArticle): Promise<string> {
		if (this.isImageArticle(article)) {
			return await this.formatImageEntry(article);
		}

		if (this.isLinkArticle(article)) {
			return this.renderLinkTemplate(article);
		}

		const content = await this.cuboxApi.getArticleDetail(article.id);
		if (!content) {
			throw new Error(`Cubox entry ${article.id} returned empty content.`);
		}

		return content;
	}

	private isImageArticle(article: CuboxArticle): boolean {
		return article.type === 'Image';
	}

	private async formatImageEntry(article: CuboxArticle): Promise<string> {
		const content = await this.cuboxApi.getArticleDetail(article.id);
		if (!content) {
			throw new Error(`Cubox image entry ${article.id} returned empty content.`);
		}

		const imageUrl = this.extractFirstImageUrl(content);
		const localPath = await this.downloadImage(imageUrl, article.id);
		const width = this.settings.imageEmbedWidth;
		const widthToken = width > 0 ? `|${width}` : '';
		return `![${widthToken}](${this.encodeVaultPath(localPath)})`;
	}

	private extractFirstImageUrl(content: string): string {
		const match = content.match(/!\[[^\]]*]\(([^)]+)\)/);
		if (!match || !match[1]) {
			const urlMatch = content.match(/https?:\/\/[^\s)]+\.(png|jpe?g|gif|webp)/i);
			if (urlMatch && urlMatch[0]) {
				return urlMatch[0];
			}
			throw new Error('Cubox image content does not include an image URL yet.');
		}
		return match[1];
	}

	private async downloadImage(imageUrl: string, articleId: string): Promise<string> {
		// @@@image-download - save Cubox image to a stable local path for embedding.
		const folder = this.settings.imageFolder.trim();
		const folderPath = folder ? normalizePath(folder) : '';
		await this.ensureFolder(folderPath);

		let extension = '.jpg';
		try {
			const url = new URL(imageUrl);
			const extname = path.extname(url.pathname);
			if (extname) {
				extension = extname;
			}
		} catch (error) {
			throw new Error(`Invalid image URL: ${imageUrl}`);
		}

		const filename = `${articleId}${extension}`;
		const filePath = normalizePath(folderPath ? `${folderPath}/${filename}` : filename);
		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			return filePath;
		}

		const response = await requestUrl({ url: imageUrl, method: 'GET' });
		if (response.status >= 400) {
			throw new Error(`Image download failed with status ${response.status}`);
		}

		await this.app.vault.createBinary(filePath, response.arrayBuffer);
		return filePath;
	}

	private encodeVaultPath(filePath: string): string {
		return filePath
			.split('/')
			.map(segment => encodeURIComponent(segment))
			.join('/');
	}

	private async ensureFolder(folderPath: string) {
		if (!folderPath) {
			return;
		}

		const existing = this.app.vault.getAbstractFileByPath(folderPath);
		if (!existing) {
			await this.app.vault.createFolder(folderPath);
			return;
		}

		if (!(existing instanceof TFolder)) {
			throw new Error(`Image folder path is not a folder: ${folderPath}`);
		}
	}

	private async appendToFile(file: TFile, payload: string) {
		const existing = await this.app.vault.read(file);
		const trimmedPayload = payload.replace(/^\n+|\n+$/g, '');
		const separator = existing.length > 0 && trimmedPayload.length > 0 ? '\n\n' : '';
		await this.app.vault.modify(file, `${existing}${separator}${trimmedPayload}`);
	}

	private async getTodayDailyNote(): Promise<TFile> {
		// @@@daily-note - resolve today note from the core Daily Notes plugin settings.
		const dailyNotesPlugin = (this.app as any).internalPlugins?.getPluginById?.('daily-notes');
		if (!dailyNotesPlugin || !dailyNotesPlugin.enabled) {
			console.error('CuboxDailySync: Daily Notes core plugin is disabled');
			throw new Error('Daily Notes core plugin is disabled.');
		}

		const settings = dailyNotesPlugin.instance?.options;
		if (!settings) {
			console.error('CuboxDailySync: Daily Notes settings not available');
			throw new Error('Daily Notes settings are unavailable.');
		}

		const moment = (window as any).moment;
		const date = moment();
		const fileName = `${date.format(settings.format)}.md`;
		const folder = settings.folder ? settings.folder.trim() : '';
		const filePath = normalizePath(folder ? `${folder}/${fileName}` : fileName);

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			return existing;
		}

		return await this.app.vault.create(filePath, '');
	}
}
