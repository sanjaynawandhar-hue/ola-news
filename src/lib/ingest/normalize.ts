import { sanitizeText, sanitizeUrl } from '@/lib/sanitize';
import {
  canonicalizeUrl, hostnameOf, isRedundantDescription, normalizeTitle, sha1, simhash,
} from '@/lib/utils';
import type { NormalizedItem, RawItem } from '@/types';

export interface NormalizeContext {
  sourceId: string;
  sourceKey: string;
  sourceName: string;
  defaultLanguage: string;
  defaultCountry: string;
  isDemo: boolean;
  /** Items older than this are dropped at ingestion. */
  maxAgeDays?: number;
  now?: Date;
}

/**
 * Turns an adapter's raw item into the canonical persisted shape.
 * Returns null when the item is unusable (no title, no valid link, unparseable
 * or implausible date, or older than the retention window).
 */
export function normalizeItem(raw: RawItem, ctx: NormalizeContext): NormalizedItem | null {
  const now = ctx.now ?? new Date();
  const title = sanitizeText(raw.title, 500);
  const url = sanitizeUrl(raw.url);
  if (!title || title.length < 8 || !url) return null;

  const publishedAt = parsePublishedAt(raw.publishedAt, now);
  if (!publishedAt) return null;
  if (ctx.maxAgeDays && publishedAt.getTime() < now.getTime() - ctx.maxAgeDays * 86400000) {
    return null;
  }

  const canonical = canonicalizeUrl(url);
  const cleanedDescription = sanitizeText(raw.description, 1200) || null;
  // A description that merely restates the headline is not a summary.
  const description = isRedundantDescription(title, cleanedDescription) ? null : cleanedDescription;
  const publisher =
    sanitizeText(raw.publisher, 120) || prettifyHost(hostnameOf(canonical)) || ctx.sourceName;

  return {
    sourceId: ctx.sourceId,
    sourceKey: ctx.sourceKey,
    publisher,
    externalId: sanitizeText(raw.externalId, 300) || null,
    title,
    description,
    url,
    canonicalUrl: canonical,
    urlHash: sha1(canonical),
    contentHash: sha1(normalizeTitle(title)),
    simhash: simhash(`${title} ${description ?? ''}`),
    imageUrl: sanitizeUrl(raw.imageUrl),
    author: sanitizeText(raw.author, 120) || null,
    publishedAt,
    language: (raw.language ?? ctx.defaultLanguage ?? 'en').slice(0, 5).toLowerCase(),
    country: (raw.country ?? ctx.defaultCountry ?? 'IN').slice(0, 2).toUpperCase(),
    isDemo: ctx.isDemo,
    meta: (raw.meta ?? {}) as Record<string, unknown>,
  };
}

/**
 * Feeds use a wide range of date formats and some omit the date entirely.
 * A missing or unparseable date falls back to "now" so the item is still
 * usable, but an implausible future/ancient date is rejected.
 */
export function parsePublishedAt(value: RawItem['publishedAt'], now = new Date()): Date | null {
  if (value === null || value === undefined || value === '') return now;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return now;
  // Allow a small clock-skew window into the future.
  if (date.getTime() > now.getTime() + 6 * 3600000) return now;
  if (date.getTime() < now.getTime() - 3650 * 86400000) return null;
  return date;
}

function prettifyHost(host: string): string {
  if (!host) return '';
  const base = host.split('.').slice(0, -1).join('.') || host;
  return base
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
