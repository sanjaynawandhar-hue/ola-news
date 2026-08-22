/**
 * Minimal, dependency-free sanitiser for third-party strings.
 * Every value that reaches the UI from an external feed passes through here.
 * We render text only — no HTML from feeds is ever injected into the DOM.
 */

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“',
  '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
};

export function decodeEntities(input: string): string {
  return (input || '')
    .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => safeCodePoint(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f]', 'g');

/** Strip all markup and control characters, collapse whitespace. */
export function sanitizeText(input: unknown, maxLength = 4000): string {
  if (typeof input !== 'string') return '';
  let text = input.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]*>/g, ' ');
  text = decodeEntities(text);
  text = text.replace(CONTROL_CHARS, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength);
}

/** Only http(s) URLs are ever stored or rendered as links. */
export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = decodeEntities(input.trim());
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
