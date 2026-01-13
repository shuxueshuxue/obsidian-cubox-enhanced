import { requestUrl } from 'obsidian';

export interface CuboxArticle {
    id: string;
    title: string;
    url: string;
    create_time: string;
    update_time: string;
    type: string;
}

interface ListResponse {
    code: number;
    message: string;
    data: CuboxArticle[];
}

interface ContentResponse {
    code: number;
    message: string;
    data: string;
}

export class CuboxApi {
    private endpoint: string;
    private apiKey: string;

    constructor(domain: string, apiKey: string) {
        this.endpoint = `https://${domain}`;
        this.apiKey = apiKey;
    }

    /**
     * 同时更新域名和 API Key
     */
    updateConfig(domain: string, apiKey: string): void {
        this.endpoint = `https://${domain}`;
        this.apiKey = apiKey;
    }

    private async request(path: string, options: RequestInit = {}) {
        const url = `${this.endpoint}${path}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };

        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    headers[key] = value;
                }
            });
        }

        const response = await requestUrl({
            url: url,
            method: options.method || 'GET',
            body: options.body as string | ArrayBuffer | undefined,
            headers: headers,
        });

        if (response.status >= 400) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return JSON.parse(response.text);
    }

    /**
     * 获取文章列表（按更新时间降序）
     */
    async getArticlesPage(
        lastCardId: string | null,
        lastCardUpdateTime: string | null,
        limit: number = 500
    ): Promise<{ articles: CuboxArticle[], hasMore: boolean}> {
        const requestBody: Record<string, any> = {
            limit: limit,
        };

        const pageSize = limit;

        if (lastCardId && lastCardUpdateTime) {
            requestBody.last_card_id = lastCardId;
            requestBody.last_card_update_time = lastCardUpdateTime;
        }

        const path = `/c/api/third-party/card/filter`;
        const response = await this.request(path, {
            method: 'POST',
            body: JSON.stringify(requestBody),
        }) as ListResponse;

        const articles = response.data ?? [];
        const hasMore = articles.length >= pageSize;

        return {
            articles,
            hasMore,
        };
    }

    /**
     * 获取文章详情，包括内容
     * @param articleId 文章ID
     */
    async getArticleDetail(articleId: string): Promise<string | null> {
        const path = `/c/api/third-party/card/content?id=${articleId}`;
        const response = await this.request(path) as ContentResponse;

        return response.data;
    }
}
