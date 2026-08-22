import { fetchWithRetry } from '@/lib/http';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';
import type { RawItem } from '@/types';
import type { AdapterContext, SourceAdapter } from './types';

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  socialimage?: string;
}

/** GDELT returns `seendate` as YYYYMMDDTHHMMSSZ. */
export function parseGdeltDate(value?: string): string | null {
  if (!value) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

const LANGUAGE_CODES: Record<string, string> = {
  English: 'en', Hindi: 'hi', Tamil: 'ta', Telugu: 'te', Marathi: 'mr',
  Bengali: 'bn', Kannada: 'kn', Malayalam: 'ml', Gujarati: 'gu', Spanish: 'es',
  French: 'fr', German: 'de', Japanese: 'ja', Chinese: 'zh',
};

const COUNTRY_CODES: Record<string, string> = {
  India: 'IN', 'United States': 'US', 'United Kingdom': 'GB', Singapore: 'SG',
  'United Arab Emirates': 'AE', Australia: 'AU', Japan: 'JP', Germany: 'DE',
  France: 'FR', China: 'CN', Netherlands: 'NL', Canada: 'CA',
};

export function mapGdeltArticles(articles: GdeltArticle[]): RawItem[] {
  const items: RawItem[] = [];
  for (const article of articles) {
    const url = sanitizeUrl(article.url);
    const title = sanitizeText(article.title, 500);
    if (!url || !title) continue;
    items.push({
      title,
      description: null, // GDELT does not license article text; headline + link only.
      url,
      publishedAt: parseGdeltDate(article.seendate),
      publisher: sanitizeText(article.domain, 120) || null,
      imageUrl: sanitizeUrl(article.socialimage),
      language: LANGUAGE_CODES[article.language ?? ''] ?? 'en',
      country: COUNTRY_CODES[article.sourcecountry ?? ''] ?? 'IN',
      meta: { gdeltDomain: article.domain ?? null },
    });
  }
  return items;
}

/** GDELT throttles aggressively by IP; keep each run to a few focused queries. */
const MAX_QUERIES_PER_RUN = 3;

/**
 * GDELT DOC 2.0 API — a free, public global news index. It is rate limited to
 * roughly one request every five seconds, which the source config enforces.
 * A 429 from GDELT is surfaced as a source failure rather than being retried
 * indefinitely or masked with empty results.
 */
export const gdeltAdapter: SourceAdapter = {
  key: 'gdelt',
  description:
    'GDELT DOC 2.0 global news index (free, public API, ~1 request / 5s). Returns headline, publisher domain and link.',
  async fetchItems(ctx: AdapterContext): Promise<RawItem[]> {
    const base = ctx.endpoint ?? 'https://api.gdeltproject.org/api/v2/doc/doc';
    const collected: RawItem[] = [];
    // GDELT asks for roughly one request every five seconds and throttles by IP
    // over a longer window, so only the highest-priority terms are queried.
    const queries = ctx.queries.slice(0, MAX_QUERIES_PER_RUN);
    const perQuery = Math.max(5, Math.ceil(ctx.maxItems / Math.max(1, queries.length)));

    for (const query of queries) {
      if (collected.length >= ctx.maxItems) break;
      const url =
        `${base}?query=${encodeURIComponent(`"${query}"`)}` +
        `&mode=ArtList&format=json&maxrecords=${perQuery}&sort=DateDesc&timespan=14d`;
      const { body } = await fetchWithRetry(
        url,
        { timeoutMs: ctx.timeoutMs, accept: 'application/json' },
        Math.max(ctx.rateLimitMs, 5200),
      );
      let payload: { articles?: GdeltArticle[] };
      try {
        payload = JSON.parse(body);
      } catch {
        // GDELT returns a plain-text notice when throttled.
        throw new Error(`GDELT returned a non-JSON response: ${sanitizeText(body, 160)}`);
      }
      collected.push(...mapGdeltArticles(payload.articles ?? []));
    }
    return collected.slice(0, ctx.maxItems);
  },
};
