import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { FetchError, fetchWithRetry, resetHostThrottle } from '@/lib/http';
import { rateLimit, resetRateLimits, clientKey } from '@/lib/rate-limit';
import { matchesCriteria } from '@/lib/alerts';
import { sanitizeText, sanitizeUrl, decodeEntities } from '@/lib/sanitize';
import { parseJson, stringifyJson } from '@/lib/utils';
import type { AlertCriteria } from '@/types';

describe('source failure handling', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetHostThrottle();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('returns the body on success', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response('<rss></rss>', {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        }),
    ) as unknown as typeof fetch;

    const result = await fetchWithRetry('https://example.com/feed', { retries: 0 }, 0);
    expect(result.status).toBe(200);
    expect(result.body).toBe('<rss></rss>');
  });

  it('does not retry a 403 and reports it as a permissions problem', async () => {
    const spy = vi.fn(async () => new Response('denied', { status: 403 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(fetchWithRetry('https://blocked.example/feed', { retries: 3 }, 0)).rejects.toThrow(
      /Access denied by the publisher/,
    );
    // A 403 is a terms/permissions signal, not a transient failure.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 and surfaces the status code when it keeps failing', async () => {
    const spy = vi.fn(async () => new Response('slow down', { status: 429 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    await expect(
      fetchWithRetry('https://throttled.example/feed', { retries: 1 }, 0),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('retries a 500 and succeeds on a later attempt', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? new Response('boom', { status: 500 })
        : new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    const result = await fetchWithRetry('https://flaky.example/feed', { retries: 2 }, 0);
    expect(result.body).toBe('ok');
    expect(calls).toBe(2);
  });

  it('reports a network error as retryable and eventually fails cleanly', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;

    await expect(
      fetchWithRetry('https://down.example/feed', { retries: 1 }, 0),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it('sends an identifying user agent', async () => {
    const spy = vi.fn(async () => new Response('ok', { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    await fetchWithRetry('https://example.com/feed', { retries: 0 }, 0);
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['user-agent']).toContain('OlaNewsBot');
  });
});

describe('API rate limiting', () => {
  beforeEach(() => resetRateLimits());

  it('allows requests up to the limit and blocks beyond it', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('test', 3, 60000).ok).toBe(true);
    }
    const blocked = rateLimit('test', 3, 60000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('keeps separate buckets per key', () => {
    expect(rateLimit('a', 1, 60000).ok).toBe(true);
    expect(rateLimit('b', 1, 60000).ok).toBe(true);
    expect(rateLimit('a', 1, 60000).ok).toBe(false);
  });

  it('resets after the window elapses', async () => {
    expect(rateLimit('window', 1, 5).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rateLimit('window', 1, 5).ok).toBe(true);
  });

  it('derives a client key from proxy headers', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(clientKey(request, 'feed')).toBe('203.0.113.5:feed');
  });
});

describe('alert matching', () => {
  const article = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'a1',
      title: 'Ola Electric recalls scooters after safety defect',
      description: 'The manufacturer announced a voluntary recall.',
      publisher: 'Example Wire',
      publishedAt: new Date(),
      analysis: {
        categoryKey: 'safety-recalls',
        primaryCompanyKey: 'ola-electric',
        companyKeys: stringifyJson(['ola-electric']),
        relevance: 100,
        importanceScore: 70,
      },
      sentiment: { label: 'NEGATIVE' },
      risk: { level: 'HIGH' },
      entities: [
        { type: 'COMPANY', value: 'Ola Electric' },
        { type: 'REGULATOR', value: 'SEBI' },
        { type: 'PERSON', value: 'Bhavish Aggarwal' },
      ],
      ...overrides,
    }) as Parameters<typeof matchesCriteria>[0];

  it('matches on a keyword', () => {
    expect(matchesCriteria(article(), { keywords: ['recall'] })).not.toHaveLength(0);
  });

  it('does not match when the keyword is absent', () => {
    expect(matchesCriteria(article(), { keywords: ['bankruptcy'] })).toHaveLength(0);
  });

  it('matches on company key', () => {
    expect(matchesCriteria(article(), { companyKeys: ['ola-electric'] })).not.toHaveLength(0);
    expect(matchesCriteria(article(), { companyKeys: ['krutrim'] })).toHaveLength(0);
  });

  it('requires every supplied condition to match', () => {
    // The keyword matches but the category does not, so the alert must not fire.
    expect(
      matchesCriteria(article(), { keywords: ['recall'], categories: ['financial-performance'] }),
    ).toHaveLength(0);
  });

  it('matches a minimum risk level and rejects below it', () => {
    expect(matchesCriteria(article(), { minRiskLevel: 'MEDIUM' })).not.toHaveLength(0);
    expect(matchesCriteria(article({ risk: { level: 'LOW' } }), { minRiskLevel: 'HIGH' })).toHaveLength(
      0,
    );
  });

  it('matches a regulatory authority entity', () => {
    expect(matchesCriteria(article(), { authorities: ['SEBI'] })).not.toHaveLength(0);
    expect(matchesCriteria(article(), { authorities: ['CCI'] })).toHaveLength(0);
  });

  it('matches a tracked executive', () => {
    expect(matchesCriteria(article(), { executives: ['Bhavish Aggarwal'] })).not.toHaveLength(0);
  });

  it('never matches an alert whose only rule is a volume spike', () => {
    // Volume-spike alerts are evaluated over the window, not per article.
    const criteria: AlertCriteria = { volumeSpike: { multiplier: 2, windowHours: 24 } };
    expect(matchesCriteria(article(), criteria)).toHaveLength(0);
  });

  it('never matches an empty criteria object', () => {
    expect(matchesCriteria(article(), {})).toHaveLength(0);
  });
});

describe('sanitisation of external data', () => {
  it('strips markup and scripts from feed text', () => {
    expect(sanitizeText('<script>alert(1)</script>Hello <b>world</b>')).toBe('Hello world');
    expect(sanitizeText('<style>.a{}</style>Text')).toBe('Text');
  });

  it('decodes HTML entities', () => {
    expect(decodeEntities('Ola &amp; Krutrim &#8212; news')).toBe('Ola & Krutrim — news');
  });

  it('removes control characters and collapses whitespace', () => {
    // Built from char codes so the fixture itself stays free of raw control bytes.
    const raw = ['a', String.fromCharCode(0), 'b', String.fromCharCode(7), 'c', '   ', 'd'].join('');
    expect(sanitizeText(raw)).toBe('a b c d');
  });

  it('returns an empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(42)).toBe('');
  });

  it('accepts only http(s) URLs', () => {
    expect(sanitizeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(sanitizeUrl('http://example.com/a')).toBe('http://example.com/a');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>')).toBeNull();
    expect(sanitizeUrl('/relative/path')).toBeNull();
    expect(sanitizeUrl(null)).toBeNull();
  });

  it('round-trips JSON columns safely', () => {
    expect(parseJson(stringifyJson(['a', 'b']), [])).toEqual(['a', 'b']);
    expect(parseJson('not json', ['fallback'])).toEqual(['fallback']);
    expect(parseJson(null, [])).toEqual([]);
  });
});
