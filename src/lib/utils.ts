import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createHash } from 'node:crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe JSON parse for the JSON-encoded String columns. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

/** Strip tracking params and fragments so the same article resolves to one URL. */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid', 'ref', 'referrer', 'source',
  'cmpid', 'CMP', 'ncid', 'at_medium', 'at_campaign', 'sh', 'amp',
];

export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
    url.hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return raw.trim();
  }
}

export function hostnameOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

const STOPWORDS = new Set(
  ('a an the and or but if then than that this these those of for to in on at by with from as is are was were be been being it its ' +
    'has have had will would can could should may might said says say new news report reports according over after before amid into ' +
    'about more most also up down out very just now year years month months week weeks day days rs cr crore lakh')
    .split(/\s+/),
);

export function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+&.-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-&+]+|[.\-&+]+$/g, ''))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Normalised headline used for exact-duplicate detection. */
export function normalizeTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 64-bit SimHash over token frequencies. Two near-identical stories produce
 * fingerprints with a small Hamming distance, which is how syndicated copy is
 * detected without comparing full article text.
 */
export function simhash(text: string): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) return '0'.repeat(16);
  const weights = new Map<string, number>();
  for (const t of tokens) weights.set(t, (weights.get(t) ?? 0) + 1);

  const vector = new Array<number>(64).fill(0);
  for (const [token, weight] of weights) {
    const digest = createHash('md5').update(token).digest();
    for (let bit = 0; bit < 64; bit++) {
      const byte = digest[bit >> 3];
      const isSet = (byte >> (7 - (bit % 8))) & 1;
      vector[bit] += isSet ? weight : -weight;
    }
  }
  let hex = '';
  for (let nibble = 0; nibble < 16; nibble++) {
    let value = 0;
    for (let b = 0; b < 4; b++) value = (value << 1) | (vector[nibble * 4 + b] > 0 ? 1 : 0);
    hex += value.toString(16);
  }
  return hex;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/** Jaccard similarity of token sets — used alongside simhash for clustering. */
export function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

/**
 * Escapes a term and matches it on word boundaries, allowing flexible internal
 * whitespace. Plain substring matching produced false positives across the
 * whole pipeline — "happened" matching the keyword "app", "competition"
 * matching the risk term "petition" — so every keyword lookup goes through here.
 */
const INFLECTIONS = '(?:s|es|ed|d|ing|ion|ions|al|ers|er)?';

export function termPattern(term: string, flags = 'iu'): RegExp {
  const trimmed = term.trim();
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  // Keyword lists are written in base form ("unveil", "recall", "petition").
  // A common English inflection is allowed after the term so "unveils" and
  // "recalled" match, while the leading boundary still stops "competition"
  // matching "petition". Very short terms ("ai", "ev") stay exact, because an
  // inflected match there would be noise ("aid", "ever").
  const suffix = trimmed.length >= 4 ? INFLECTIONS : '';
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}${suffix}(?![\\p{L}\\p{N}])`, flags);
}

export function matchesTerm(haystack: string, term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  return termPattern(trimmed).test(haystack);
}

export function countTerm(haystack: string, term: string): number {
  const trimmed = term.trim();
  if (!trimmed) return 0;
  return (haystack.match(termPattern(trimmed, 'giu')) ?? []).length;
}

/**
 * True when a feed's description adds nothing beyond the headline.
 *
 * Several aggregators (Google News in particular) put an anchor tag wrapping
 * the headline into <description>, which sanitises down to "Headline Publisher".
 * Storing that as the publisher's summary would make the story card show the
 * same sentence twice, so it is treated as "no summary was syndicated".
 */
export function isRedundantDescription(
  title: string,
  description: string | null | undefined,
): boolean {
  if (!description) return true;

  const normalisedTitle = normalizeTitle(title);
  const normalisedDescription = normalizeTitle(description);
  if (!normalisedTitle || !normalisedDescription) return true;
  if (normalisedDescription === normalisedTitle) return true;

  // "Headline Publisher" — the headline plus a short trailing attribution.
  if (
    normalisedDescription.startsWith(normalisedTitle) &&
    normalisedDescription.length <= normalisedTitle.length * 1.35 + 25
  ) {
    return true;
  }

  return jaccard(tokenize(title), tokenize(description)) >= 0.85;
}

/**
 * Hosts that serve a redirect to the real publisher rather than the article.
 *
 * Google News RSS links are opaque base64 blobs that only resolve in a browser
 * (the redirect is performed by JavaScript, so it cannot be followed
 * server-side without reverse-engineering an undocumented endpoint). The link
 * works for a reader, but printing the raw URL would show a meaningless blob
 * under a headline attributed to a named publisher.
 */
const AGGREGATOR_HOSTS: Record<string, string> = {
  'news.google.com': 'Google News',
};

export function aggregatorOf(url: string): string | null {
  const host = hostnameOf(url);
  return AGGREGATOR_HOSTS[host] ?? null;
}

/**
 * How a link should be described to a reader: the publisher's own domain when
 * the link points at it, or "via <aggregator>" when it is a redirect.
 */
export function linkAttribution(url: string, maxLength = 48): string {
  const aggregator = aggregatorOf(url);
  if (aggregator) return `via ${aggregator}`;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path =
      parsed.pathname.length > maxLength - host.length
        ? `${parsed.pathname.slice(0, Math.max(0, maxLength - host.length))}…`
        : parsed.pathname;
    return `${host}${path === '/' ? '' : path}`;
  } catch {
    return url.slice(0, maxLength);
  }
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function truncate(text: string, max: number): string {
  const clean = (text || '').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '') + '…';
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
