import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type CuboxDailySyncPlugin from './main';

export const DEFAULT_LINK_TEMPLATE = '[{{title}}]({{url}})';

export interface CuboxDailySyncSettings {
	domain: string;
	apiKey: string;
	syncFrequencyMinutes: number;
	linkTemplate: string;
	lastSyncTime: number;
	lastSyncCardId: string | null;
	lastSyncCardUpdateTime: string | null;
	recentSyncedIds: string[];
	syncing: boolean;
}

export const DEFAULT_SETTINGS: CuboxDailySyncSettings = {
	domain: '',
	apiKey: '',
	syncFrequencyMinutes: 5,
	linkTemplate: DEFAULT_LINK_TEMPLATE,
	lastSyncTime: 0,
	lastSyncCardId: null,
	lastSyncCardUpdateTime: null,
	recentSyncedIds: [],
	syncing: false,
};

export class CuboxDailySyncSettingTab extends PluginSettingTab {
	plugin: CuboxDailySyncPlugin;

	constructor(app: App, plugin: CuboxDailySyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Cubox server domain')
			.setDesc('Select the Cubox domain you use.')
			.addDropdown(dropdown => dropdown
				.addOption('', 'Choose region')
				.addOption('cubox.cc', 'cubox.cc (international)')
				.addOption('cubox.pro', 'cubox.pro')
				.setValue(this.plugin.settings.domain)
				.onChange(async (value) => {
					this.plugin.settings.domain = value;
					await this.plugin.saveSettings();
					this.plugin.updateCuboxApiConfig(value, this.plugin.settings.apiKey);
				}));

		new Setting(containerEl)
			.setName('Cubox API key')
			.setDesc('Paste your API key or the full API link from Cubox.')
			.addText(text => {
				text.setPlaceholder('API key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						let apiKey = value.trim();
						if (apiKey.includes('://')) {
							try {
								const url = new URL(apiKey);
								const parts = url.pathname.split('/').filter(Boolean);
								if (parts.length == 0) {
									throw new Error('API key not found in URL.');
								}
								apiKey = parts[parts.length - 1];
								text.setValue(apiKey);
							} catch (error) {
								new Notice('Invalid API key URL.');
								return;
							}
						}
						this.plugin.settings.apiKey = apiKey;
						await this.plugin.saveSettings();
						this.plugin.updateCuboxApiConfig(this.plugin.settings.domain, this.plugin.settings.apiKey);
					});
			});

	new Setting(containerEl)
		.setName('Sync frequency (minutes)')
		.setDesc('How often to check for new Cubox entries. Set to 0 to disable auto sync.')
		.addText(text => {
			text.inputEl.type = 'number';
			text.setValue(String(this.plugin.settings.syncFrequencyMinutes))
					.onChange(async (value) => {
						this.plugin.settings.syncFrequencyMinutes = Number(value);
						await this.plugin.saveSettings();
						this.plugin.setupAutoSync();
					});
			});

		new Setting(containerEl)
			.setName('Link template')
			.setDesc('Use {{title}} and {{url}}. Applies to link items.')
			.addTextArea(text => {
				text.setValue(this.plugin.settings.linkTemplate)
					.onChange(async (value) => {
						this.plugin.settings.linkTemplate = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 2;
			});
	}
}
