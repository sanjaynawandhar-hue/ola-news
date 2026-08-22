import { fetchWithRetry } from '@/lib/http';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';
import type { RawItem } from '@/types';
import type { AdapterContext, SourceAdapter } from './types';

/**
 * Adapters for commercial news APIs. Each stays in AWAITING_CREDENTIALS mode
 * until its API key is present in the server environment — the dashboard never
 * fabricates results for a source it cannot actually reach.
 */

function requireCredential(ctx: AdapterContext, name: string): string {
  if (!ctx.credential) {
    throw new Error(`${name} is not configured. Set its API key in the server environment.`);
  }
  return ctx.credential;
}

export const newsApiAdapter: SourceAdapter = {
  key: 'newsapi',
  description: 'NewsAPI.org /v2/everything. Requires NEWSAPI_KEY. Stores title, description and link only.',
  async fetchItems(ctx) {
    const key = requireCredential(ctx, 'NewsAPI.org');
    const query = ctx.queries.map((q) => `"${q}"`).join(' OR ');
    const url =
      `${ctx.endpoint ?? 'https://newsapi.org/v2/everything'}?q=${encodeURIComponent(query)}` +
      `&language=en&sortBy=publishedAt&pageSize=${Math.min(100, ctx.maxItems)}`;
    const { body } = await fetchWithRetry(
      url,
      { timeoutMs: ctx.timeoutMs, accept: 'application/json', headers: { 'x-api-key': key } },
      ctx.rateLimitMs,
    );
    const payload = JSON.parse(body) as {
      status?: string;
      message?: string;
      articles?: Array<{
        title?: string; description?: string; url?: string; publishedAt?: string;
        author?: string; urlToImage?: string; source?: { name?: string };
      }>;
    };
    if (payload.status && payload.status !== 'ok') {
      throw new Error(sanitizeText(payload.message, 200) || 'NewsAPI request failed');
    }
    return mapGeneric(payload.articles ?? [], (a) => ({
      title: a.title, description: a.description, url: a.url,
      publishedAt: a.publishedAt, author: a.author,
      imageUrl: a.urlToImage, publisher: a.source?.name,
    }));
  },
};

export const newsDataAdapter: SourceAdapter = {
  key: 'newsdata',
  description: 'NewsData.io /api/1/news. Requires NEWSDATA_API_KEY.',
  async fetchItems(ctx) {
    const key = requireCredential(ctx, 'NewsData.io');
    const query = ctx.queries.slice(0, 5).map((q) => `"${q}"`).join(' OR ');
    const url =
      `${ctx.endpoint ?? 'https://newsdata.io/api/1/news'}?apikey=${encodeURIComponent(key)}` +
      `&q=${encodeURIComponent(query)}&language=en`;
    const { body } = await fetchWithRetry(
      url, { timeoutMs: ctx.timeoutMs, accept: 'application/json' }, ctx.rateLimitMs,
    );
    const payload = JSON.parse(body) as {
      status?: string; results?: Array<{
        title?: string; description?: string; link?: string; pubDate?: string;
        creator?: string[]; image_url?: string; source_id?: string; language?: string; country?: string[];
      }>;
    };
    return mapGeneric(payload.results ?? [], (a) => ({
      title: a.title, description: a.description, url: a.link,
      publishedAt: a.pubDate, author: a.creator?.[0],
      imageUrl: a.image_url, publisher: a.source_id,
      language: a.language, country: a.country?.[0],
    }));
  },
};

export const gnewsAdapter: SourceAdapter = {
  key: 'gnews',
  description: 'GNews.io /api/v4/search. Requires GNEWS_API_KEY.',
  async fetchItems(ctx) {
    const key = requireCredential(ctx, 'GNews.io');
    const query = ctx.queries.slice(0, 5).map((q) => `"${q}"`).join(' OR ');
    const url =
      `${ctx.endpoint ?? 'https://gnews.io/api/v4/search'}?q=${encodeURIComponent(query)}` +
      `&lang=en&max=${Math.min(100, ctx.maxItems)}&apikey=${encodeURIComponent(key)}`;
    const { body } = await fetchWithRetry(
      url, { timeoutMs: ctx.timeoutMs, accept: 'application/json' }, ctx.rateLimitMs,
    );
    const payload = JSON.parse(body) as {
      articles?: Array<{
        title?: string; description?: string; url?: string; publishedAt?: string;
        image?: string; source?: { name?: string };
      }>;
    };
    return mapGeneric(payload.articles ?? [], (a) => ({
      title: a.title, description: a.description, url: a.url,
      publishedAt: a.publishedAt, imageUrl: a.image, publisher: a.source?.name,
    }));
  },
};

export const bingNewsAdapter: SourceAdapter = {
  key: 'bing-news',
  description: 'Bing News Search API. Requires BING_NEWS_API_KEY.',
  async fetchItems(ctx) {
    const key = requireCredential(ctx, 'Bing News Search');
    const query = ctx.queries.slice(0, 5).map((q) => `"${q}"`).join(' OR ');
    const url =
      `${ctx.endpoint ?? 'https://api.bing.microsoft.com/v7.0/news/search'}?q=${encodeURIComponent(query)}` +
      `&count=${Math.min(100, ctx.maxItems)}&mkt=en-IN&sortBy=Date`;
    const { body } = await fetchWithRetry(
      url,
      { timeoutMs: ctx.timeoutMs, accept: 'application/json', headers: { 'Ocp-Apim-Subscription-Key': key } },
      ctx.rateLimitMs,
    );
    const payload = JSON.parse(body) as {
      value?: Array<{
        name?: string; description?: string; url?: string; datePublished?: string;
        provider?: Array<{ name?: string }>; image?: { thumbnail?: { contentUrl?: string } };
      }>;
    };
    return mapGeneric(payload.value ?? [], (a) => ({
      title: a.name, description: a.description, url: a.url,
      publishedAt: a.datePublished, publisher: a.provider?.[0]?.name,
      imageUrl: a.image?.thumbnail?.contentUrl,
    }));
  },
};

interface GenericFields {
  title?: string | null; description?: string | null; url?: string | null;
  publishedAt?: string | null; author?: string | null; imageUrl?: string | null;
  publisher?: string | null; language?: string | null; country?: string | null;
}

function mapGeneric<T>(rows: T[], pick: (row: T) => GenericFields): RawItem[] {
  const items: RawItem[] = [];
  for (const row of rows) {
    const fields = pick(row);
    const url = sanitizeUrl(fields.url);
    const title = sanitizeText(fields.title, 500);
    if (!url || !title) continue;
    items.push({
      title,
      description: sanitizeText(fields.description, 1200) || null,
      url,
      publishedAt: fields.publishedAt ?? null,
      author: sanitizeText(fields.author, 120) || null,
      imageUrl: sanitizeUrl(fields.imageUrl),
      publisher: sanitizeText(fields.publisher, 120) || null,
      language: fields.language ?? 'en',
      country: (fields.country ?? 'IN').toUpperCase().slice(0, 2),
    });
  }
  return items;
}
