import { describe, expect, it } from 'vitest';
import { normalizeItem, parsePublishedAt } from '@/lib/ingest/normalize';
import { parseFeed } from '@/lib/ingest/adapters/rss';
import { mapGdeltArticles, parseGdeltDate } from '@/lib/ingest/adapters/gdelt';
import { canonicalizeUrl, isRedundantDescription, normalizeTitle, simhash } from '@/lib/utils';

const CTX = {
  sourceId: 'src1',
  sourceKey: 'test',
  sourceName: 'Test Source',
  defaultLanguage: 'en',
  defaultCountry: 'IN',
  isDemo: false,
};

describe('source normalization', () => {
  it('normalises a well-formed item', () => {
    const result = normalizeItem(
      {
        title: '  Ola Electric announces new S1 Pro variant  ',
        description: '<p>The company <b>said</b> deliveries begin next month.</p>',
        url: 'https://www.example.com/news/story?utm_source=rss&id=7#top',
        publishedAt: '2026-08-01T10:00:00Z',
        publisher: 'Example Wire',
      },
      CTX,
    );

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Ola Electric announces new S1 Pro variant');
    // HTML is stripped; the publisher's own wording is preserved.
    expect(result!.description).toBe('The company said deliveries begin next month.');
    // Tracking params dropped, www stripped, id kept.
    expect(result!.canonicalUrl).toBe('https://example.com/news/story?id=7');
    expect(result!.publisher).toBe('Example Wire');
    expect(result!.urlHash).toHaveLength(40);
    expect(result!.simhash).toHaveLength(16);
  });

  it('rejects items with no usable title or link', () => {
    expect(normalizeItem({ title: 'short', url: 'https://example.com/a' }, CTX)).toBeNull();
    expect(normalizeItem({ title: 'A perfectly fine headline here', url: 'javascript:alert(1)' }, CTX)).toBeNull();
    expect(normalizeItem({ title: 'A perfectly fine headline here', url: 'not-a-url' }, CTX)).toBeNull();
  });

  it('derives the publisher from the host when the feed omits it', () => {
    const result = normalizeItem(
      { title: 'Some sufficiently long headline', url: 'https://economictimes.indiatimes.com/x' },
      CTX,
    );
    expect(result!.publisher).toBe('Economictimes Indiatimes');
  });

  it('drops items older than the retention window', () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString();
    const result = normalizeItem(
      { title: 'An old headline that is long enough', url: 'https://example.com/old', publishedAt: old },
      { ...CTX, maxAgeDays: 45 },
    );
    expect(result).toBeNull();
  });

  it('falls back to now for missing or unparseable dates', () => {
    const now = new Date('2026-08-01T00:00:00Z');
    expect(parsePublishedAt(null, now)).toEqual(now);
    expect(parsePublishedAt('not a date', now)).toEqual(now);
    // Far-future timestamps are clamped to now rather than trusted.
    expect(parsePublishedAt('2030-01-01T00:00:00Z', now)).toEqual(now);
    // Absurdly old timestamps are rejected outright.
    expect(parsePublishedAt('1900-01-01T00:00:00Z', now)).toBeNull();
  });

  it('canonicalises URLs consistently', () => {
    expect(canonicalizeUrl('http://WWW.Example.COM/a/b/?utm_campaign=x')).toBe('https://example.com/a/b');
    expect(canonicalizeUrl('https://example.com/a#frag')).toBe('https://example.com/a');
  });

  it('normalises titles for exact-duplicate matching', () => {
    expect(normalizeTitle('Ola Electric’s “Big” Launch!')).toBe('ola electric s big launch');
  });
});

describe('RSS parsing', () => {
  const RSS = `<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <title>Example Wire</title>
      <item>
        <title>Ola Electric opens 100 new stores</title>
        <link>https://example.com/a</link>
        <description>&lt;p&gt;Expansion continues.&lt;/p&gt;</description>
        <pubDate>Fri, 01 Aug 2026 10:00:00 GMT</pubDate>
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">A Reporter</dc:creator>
      </item>
      <item>
        <title>Second story</title>
        <link>https://example.com/b</link>
      </item>
    </channel></rss>`;

  const ATOM = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Source</title>
      <entry>
        <title>Krutrim ships a model update</title>
        <link href="https://example.com/atom-1"/>
        <summary>Summary text.</summary>
        <published>2026-08-02T08:00:00Z</published>
      </entry>
    </feed>`;

  it('parses RSS 2.0 items', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Ola Electric opens 100 new stores');
    expect(items[0].description).toBe('Expansion continues.');
    expect(items[0].publisher).toBe('Example Wire');
    expect(items[0].author).toBe('A Reporter');
  });

  it('parses Atom entries and their href links', () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://example.com/atom-1');
    expect(items[0].title).toBe('Krutrim ships a model update');
  });

  it('returns an empty list for unusable input instead of throwing', () => {
    expect(parseFeed('<html><body>not a feed</body></html>')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
  });
});

describe('GDELT parsing', () => {
  it('converts GDELT timestamps to ISO', () => {
    expect(parseGdeltDate('20260801T101500Z')).toBe('2026-08-01T10:15:00Z');
    expect(parseGdeltDate('garbage')).toBeNull();
    expect(parseGdeltDate(undefined)).toBeNull();
  });

  it('maps articles and skips rows without a title or URL', () => {
    const items = mapGdeltArticles([
      { url: 'https://example.com/1', title: 'Ola Electric in the news', domain: 'example.com', language: 'English', sourcecountry: 'India' },
      { url: 'https://example.com/2' },
      { title: 'No link here' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].language).toBe('en');
    expect(items[0].country).toBe('IN');
    // GDELT does not license article text, so no description is stored.
    expect(items[0].description).toBeNull();
  });
});

describe('simhash', () => {
  it('produces close fingerprints for near-identical text', () => {
    const a = simhash('Ola Electric announces a recall of scooters after safety defect reports');
    const b = simhash('Ola Electric announces recall of scooters after reports of a safety defect');
    expect(a).toHaveLength(16);
    expect(a).not.toBe('0'.repeat(16));
    expect(b).not.toBe('0'.repeat(16));
  });

  it('is stable for identical input', () => {
    expect(simhash('the same text')).toBe(simhash('the same text'));
  });
});

describe('redundant descriptions', () => {
  it('treats an aggregator description that echoes the headline as no summary', () => {
    // Google News wraps the headline in an anchor, which sanitises to
    // "Headline Publisher" — that is not a summary.
    const result = normalizeItem(
      {
        title: 'Ola Electric sales have fallen another 40.0% YTD July 2026',
        description: 'Ola Electric sales have fallen another 40.0% YTD July 2026 Motorcycles Data',
        url: 'https://example.com/story',
        publishedAt: '2026-08-01T10:00:00Z',
        publisher: 'Motorcycles Data',
      },
      CTX,
    );
    expect(result!.description).toBeNull();
  });

  it('keeps a description that genuinely adds information', () => {
    const result = normalizeItem(
      {
        title: 'Ola Electric sales have fallen another 40.0% YTD July 2026',
        description:
          'Registrations across the first seven months totalled 69,202 units, with the company citing a transition between model years and a reduced incentive pool.',
        url: 'https://example.com/story-2',
        publishedAt: '2026-08-01T10:00:00Z',
        publisher: 'Motorcycles Data',
      },
      CTX,
    );
    expect(result!.description).toContain('69,202 units');
  });

  it('detects redundancy directly', () => {
    expect(isRedundantDescription('Ola Electric recalls scooters', 'Ola Electric recalls scooters')).toBe(true);
    expect(isRedundantDescription('Ola Electric recalls scooters', 'Ola Electric recalls scooters  NDTV Profit')).toBe(true);
    expect(isRedundantDescription('Ola Electric recalls scooters', null)).toBe(true);
    expect(isRedundantDescription('Ola Electric recalls scooters', '')).toBe(true);
    expect(
      isRedundantDescription(
        'Ola Electric recalls scooters',
        'The company said roughly 10,000 units built between March and May are affected and will be repaired free of charge.',
      ),
    ).toBe(false);
  });
});
