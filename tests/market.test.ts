import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INSTRUMENTS,
  getMarketSnapshot,
  resetMarketCache,
  toRelativePerformance,
  type MarketQuote,
} from '@/lib/market/quotes';
import { resetHostThrottle } from '@/lib/http';

const realFetch = globalThis.fetch;

/** Minimal Yahoo chart payload. */
function chartPayload(closes: Array<number | null>, price: number, prevClose: number) {
  const start = 1_754_000_000;
  return {
    chart: {
      result: [
        {
          meta: {
            currency: 'INR',
            symbol: 'TEST',
            fullExchangeName: 'NSE',
            regularMarketPrice: price,
            chartPreviousClose: prevClose,
          },
          timestamp: closes.map((_, i) => start + i * 86400),
          indicators: { quote: [{ close: closes }] },
        },
      ],
      error: null,
    },
  };
}

beforeEach(() => {
  resetMarketCache();
  resetHostThrottle();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('instrument list', () => {
  it('covers the benchmarks plus the one listed tracked company', () => {
    expect(INSTRUMENTS.map((i) => i.key)).toEqual(['sensex', 'nifty', 'olaelectric']);
    // ANI Technologies and Krutrim are private — they must not appear as
    // instruments, which would render permanently empty tiles.
    expect(INSTRUMENTS.filter((i) => i.isTracked).map((i) => i.key)).toEqual(['olaelectric']);
  });
});

describe('quote parsing', () => {
  it('reads price, change and series from a chart response', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(chartPayload([100, 101, 103], 103, 101)), { status: 200 }),
    ) as unknown as typeof fetch;

    const snapshot = await getMarketSnapshot({ force: true });
    const quote = snapshot.quotes[0];
    expect(quote.price).toBe(103);
    expect(quote.previousClose).toBe(101);
    expect(quote.change).toBe(2);
    expect(quote.changePercent).toBeCloseTo(1.98, 1);
    expect(quote.series).toHaveLength(3);
    expect(quote.error).toBeUndefined();
  });

  it('drops null closes rather than plotting them as zero', async () => {
    // Holidays and trading halts come back as null.
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(chartPayload([100, null, 102, null], 102, 100)), { status: 200 }),
    ) as unknown as typeof fetch;

    const snapshot = await getMarketSnapshot({ force: true });
    expect(snapshot.quotes[0].series.map((p) => p.c)).toEqual([100, 102]);
  });

  it('reports a failing symbol instead of inventing a price', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;

    const snapshot = await getMarketSnapshot({ force: true });
    for (const quote of snapshot.quotes) {
      expect(quote.error).toBeTruthy();
      expect(quote.price).toBeNull();
      expect(quote.series).toEqual([]);
    }
    expect(snapshot.error).toMatch(/temporarily unavailable/i);
  });

  it('survives a malformed payload', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('{"chart":{"result":[]}}', { status: 200 }),
    ) as unknown as typeof fetch;

    const snapshot = await getMarketSnapshot({ force: true });
    expect(snapshot.quotes.every((q) => q.error)).toBe(true);
  });

  it('does not cache a total failure, so the next view retries', async () => {
    const failing = vi.fn(async () => new Response('nope', { status: 500 }));
    globalThis.fetch = failing as unknown as typeof fetch;
    await getMarketSnapshot({ force: true });
    const callsAfterFirst = failing.mock.calls.length;

    await getMarketSnapshot();
    expect(failing.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('caches a successful snapshot', async () => {
    const ok = vi.fn(
      async () => new Response(JSON.stringify(chartPayload([100, 102], 102, 100)), { status: 200 }),
    );
    globalThis.fetch = ok as unknown as typeof fetch;

    await getMarketSnapshot({ force: true });
    const callsAfterFirst = ok.mock.calls.length;
    await getMarketSnapshot();
    expect(ok.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('relative performance', () => {
  const quote = (key: string, closes: number[]): MarketQuote => ({
    key,
    symbol: key,
    name: key,
    shortName: key,
    currency: 'INR',
    exchange: 'NSE',
    price: closes.at(-1)!,
    previousClose: closes.at(-2) ?? null,
    change: null,
    changePercent: null,
    series: closes.map((c, i) => ({ t: 1_754_000_000 + i * 86400, c })),
    isTracked: key === 'olaelectric',
    fetchedAt: new Date().toISOString(),
  });

  it('rebases every series to 100 so different magnitudes compare', () => {
    const rows = toRelativePerformance([
      quote('sensex', [80000, 80800]), // +1%
      quote('olaelectric', [40, 38]), // -5%
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].sensex).toBe(100);
    expect(rows[0].olaelectric).toBe(100);
    expect(rows[1].sensex).toBe(101);
    expect(rows[1].olaelectric).toBe(95);
  });

  it('aligns on the shortest series so all lines share a window', () => {
    const rows = toRelativePerformance([
      quote('sensex', [100, 101, 102, 103]),
      quote('olaelectric', [40, 41]),
    ]);
    expect(rows).toHaveLength(2);
  });

  it('labels each row with a date', () => {
    const rows = toRelativePerformance([quote('sensex', [100, 101])]);
    expect(String(rows[0].date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores instruments with no usable history', () => {
    expect(toRelativePerformance([quote('sensex', [100])])).toEqual([]);
    expect(toRelativePerformance([])).toEqual([]);
  });
});
