import { XMLParser } from 'fast-xml-parser';
import { fetchWithRetry } from '@/lib/http';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';
import type { RawItem } from '@/types';
import type { AdapterContext, SourceAdapter } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if ('#text' in record) return String(record['#text'] ?? '');
    if ('@_href' in record) return String(record['@_href'] ?? '');
  }
  return '';
}

/**
 * Parses RSS 2.0 and Atom feeds. Only the fields the publisher exposes in the
 * feed (headline, short description, link, timestamp) are read — the article
 * page itself is never downloaded or copied.
 */
export function parseFeed(xml: string, fallbackPublisher = ''): RawItem[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc.rss as Record<string, unknown> | undefined;
  const rdf = doc['rdf:RDF'] as Record<string, unknown> | undefined;
  const feed = doc.feed as Record<string, unknown> | undefined;

  const channel = (rss?.channel ?? rdf) as Record<string, unknown> | undefined;
  const channelTitle = sanitizeText(textOf(channel?.title ?? feed?.title)) || fallbackPublisher;

  const rawEntries = channel
    ? asArray(channel.item as unknown)
    : feed
      ? asArray(feed.entry as unknown)
      : [];

  const items: RawItem[] = [];
  for (const entry of rawEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const node = entry as Record<string, unknown>;

    const title = sanitizeText(textOf(node.title), 500);
    const link = extractLink(node);
    if (!title || !link) continue;

    const description = sanitizeText(
      textOf(node.description ?? node.summary ?? node['content:encoded'] ?? node.content),
      1200,
    );

    const published =
      textOf(node.pubDate) ||
      textOf(node.published) ||
      textOf(node.updated) ||
      textOf(node['dc:date']) ||
      '';

    const media = node['media:content'] as Record<string, unknown> | undefined;
    const enclosure = node.enclosure as Record<string, unknown> | undefined;
    const imageUrl =
      sanitizeUrl(media?.['@_url']) ?? sanitizeUrl(enclosure?.['@_url']) ?? null;

    const sourceNode = node.source as Record<string, unknown> | string | undefined;
    const publisher =
      (typeof sourceNode === 'object' ? sanitizeText(textOf(sourceNode)) : sanitizeText(sourceNode)) ||
      channelTitle ||
      fallbackPublisher;

    items.push({
      title,
      description: description || null,
      url: link,
      publishedAt: published || null,
      author: sanitizeText(textOf(node['dc:creator'] ?? node.author), 120) || null,
      imageUrl,
      publisher,
      externalId: sanitizeText(textOf(node.guid ?? node.id), 300) || null,
    });
  }
  return items;
}

function extractLink(node: Record<string, unknown>): string | null {
  const direct = sanitizeUrl(textOf(node.link));
  if (direct) return direct;
  for (const candidate of asArray(node.link as unknown)) {
    if (candidate && typeof candidate === 'object') {
      const href = (candidate as Record<string, unknown>)['@_href'];
      const url = sanitizeUrl(href);
      if (url) return url;
    }
  }
  return sanitizeUrl(textOf(node.guid)) ?? null;
}

export const rssAdapter: SourceAdapter = {
  key: 'rss',
  description:
    'Reads publicly published RSS/Atom feeds. Stores headline, publisher-provided summary, link and metadata only.',
  async fetchItems(ctx: AdapterContext): Promise<RawItem[]> {
    if (!ctx.endpoint) throw new Error('RSS source has no endpoint configured');
    const urls = ctx.queryTemplate?.includes('{{q}}')
      ? ctx.queries.map((q) => ctx.endpoint!.replace('{{q}}', encodeURIComponent(q)))
      : [ctx.endpoint];

    const collected: RawItem[] = [];
    for (const url of urls) {
      const { body } = await fetchWithRetry(
        url,
        { timeoutMs: ctx.timeoutMs },
        ctx.rateLimitMs,
      );
      collected.push(...parseFeed(body));
      if (collected.length >= ctx.maxItems) break;
    }
    return collected.slice(0, ctx.maxItems);
  },
};

/**
 * Google News search RSS. The endpoint is query-driven, so one source produces
 * a focused feed per tracked entity.
 */
export const googleNewsAdapter: SourceAdapter = {
  key: 'google-news',
  description:
    'Google News search RSS. Query-driven; returns headline, snippet and a link to the original publisher.',
  async fetchItems(ctx: AdapterContext): Promise<RawItem[]> {
    const base =
      ctx.endpoint ?? 'https://news.google.com/rss/search?q={{q}}&hl=en-IN&gl=IN&ceid=IN:en';
    const collected: RawItem[] = [];
    const perQuery = Math.max(4, Math.ceil(ctx.maxItems / Math.max(1, ctx.queries.length)));

    for (const query of ctx.queries) {
      if (collected.length >= ctx.maxItems) break;
      const url = base.replace('{{q}}', encodeURIComponent(`${query} when:14d`));
      const { body } = await fetchWithRetry(url, { timeoutMs: ctx.timeoutMs }, ctx.rateLimitMs);
      const items = parseFeed(body).slice(0, perQuery);
      for (const item of items) {
        // Google News titles are "Headline - Publisher"; split the publisher out.
        const match = /^(.*)\s+-\s+([^-]{2,60})$/.exec(item.title);
        if (match) {
          item.title = match[1].trim();
          item.publisher = match[2].trim();
        }
        item.meta = { ...(item.meta ?? {}), query };
      }
      collected.push(...items);
    }
    return collected.slice(0, ctx.maxItems);
  },
};
