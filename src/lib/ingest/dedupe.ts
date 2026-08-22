import { hammingDistance, jaccard, tokenize } from '@/lib/utils';
import type { NormalizedItem } from '@/types';

/** Below this Hamming distance two 64-bit fingerprints describe the same story. */
export const SIMHASH_THRESHOLD = 8;
/** Token overlap required to confirm a near-duplicate flagged by simhash. */
export const JACCARD_THRESHOLD = 0.55;

export type DuplicateReason = 'url' | 'title' | 'syndicated';

export interface DedupeResult {
  unique: NormalizedItem[];
  duplicates: Array<{ item: NormalizedItem; reason: DuplicateReason }>;
}

export interface Fingerprint {
  urlHash: string;
  contentHash: string;
  simhash: string;
  title: string;
  publisher: string;
}

/**
 * Deduplication is deliberately publisher-aware.
 *
 * Dropped as duplicates:
 *   - the same canonical URL seen twice;
 *   - the same normalised headline from the same publisher;
 *   - a near-identical rewrite from the *same* publisher (syndicated reposts).
 *
 * Kept:
 *   - a near-identical story from a *different* publisher. That is independent
 *     coverage and is the raw signal for corroboration and cluster size, so it
 *     is merged into one story cluster later rather than deleted here.
 */
export function dedupeBatch(items: NormalizedItem[]): DedupeResult {
  const unique: NormalizedItem[] = [];
  const duplicates: DedupeResult['duplicates'] = [];
  const seenUrls = new Set<string>();
  const seenContent = new Set<string>();
  const kept: Array<{ simhash: string; tokens: string[]; publisher: string }> = [];

  // Prefer the earliest published copy of a story.
  const ordered = [...items].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

  for (const item of ordered) {
    const publisherKey = item.publisher.toLowerCase().trim();
    if (seenUrls.has(item.urlHash)) {
      duplicates.push({ item, reason: 'url' });
      continue;
    }
    if (seenContent.has(`${publisherKey}|${item.contentHash}`)) {
      duplicates.push({ item, reason: 'title' });
      continue;
    }
    const tokens = tokenize(item.title);
    const syndicated = kept.some(
      (fp) =>
        fp.publisher === publisherKey &&
        hammingDistance(fp.simhash, item.simhash) <= SIMHASH_THRESHOLD &&
        jaccard(fp.tokens, tokens) >= JACCARD_THRESHOLD,
    );
    if (syndicated) {
      duplicates.push({ item, reason: 'syndicated' });
      continue;
    }

    seenUrls.add(item.urlHash);
    seenContent.add(`${publisherKey}|${item.contentHash}`);
    kept.push({ simhash: item.simhash, tokens, publisher: publisherKey });
    unique.push(item);
  }

  return { unique, duplicates };
}

/** Removes items already present in the database, using the same rules. */
export function filterAgainstExisting(
  items: NormalizedItem[],
  existing: Fingerprint[],
): DedupeResult {
  const urlHashes = new Set(existing.map((e) => e.urlHash));
  const contentKeys = new Set(
    existing.map((e) => `${e.publisher.toLowerCase().trim()}|${e.contentHash}`),
  );
  const fingerprints = existing.map((e) => ({
    simhash: e.simhash,
    tokens: tokenize(e.title),
    publisher: e.publisher.toLowerCase().trim(),
  }));

  const unique: NormalizedItem[] = [];
  const duplicates: DedupeResult['duplicates'] = [];

  for (const item of items) {
    const publisherKey = item.publisher.toLowerCase().trim();
    if (urlHashes.has(item.urlHash)) {
      duplicates.push({ item, reason: 'url' });
      continue;
    }
    if (contentKeys.has(`${publisherKey}|${item.contentHash}`)) {
      duplicates.push({ item, reason: 'title' });
      continue;
    }
    const tokens = tokenize(item.title);
    const syndicated = fingerprints.some(
      (fp) =>
        fp.publisher === publisherKey &&
        hammingDistance(fp.simhash, item.simhash) <= SIMHASH_THRESHOLD &&
        jaccard(fp.tokens, tokens) >= JACCARD_THRESHOLD,
    );
    if (syndicated) {
      duplicates.push({ item, reason: 'syndicated' });
      continue;
    }
    unique.push(item);
  }
  return { unique, duplicates };
}
