import { fetchWithRetry } from '@/lib/http';
import { createLogger } from '@/lib/logger';

const log = createLogger('market');

/**
 * Market quotes for the index context a reader needs alongside company news.
 *
 * Source: Yahoo Finance's chart endpoint. It is publicly reachable and returns
 * exchange-sourced data, but it is **not a documented, supported API** — it can
 * change without notice. So it is treated exactly like every other connector in
 * this project: rate limited, failure is surfaced rather than hidden, and the
 * UI labels the data as indicative and delayed.
 *
 * Nothing here is investment advice, and no figure is ever synthesised: if the
 * upstream call fails the panel says so instead of showing a stale or invented
 * price.
 */

export interface MarketSeriesPoint {
  /** Epoch seconds of the session close. */
  t: number;
  /** Closing value. */
  c: number;
}

export interface MarketQuote {
  key: string;
  symbol: string;
  name: string;
  /** Short label for narrow layouts. */
  shortName: string;
  currency: string;
  exchange: string;
  /** Latest price, or null when the upstream response omitted it. */
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  /** Daily closes over the requested window, oldest first. */
  series: MarketSeriesPoint[];
  /** True when this instrument is one of the tracked companies. */
  isTracked: boolean;
  fetchedAt: string;
  error?: string;
}

export interface MarketSnapshot {
  quotes: MarketQuote[];
  /** Set when every instrument failed, so the UI can explain the empty panel. */
  error?: string;
  source: string;
  disclaimer: string;
}

interface Instrument {
  key: string;
  symbol: string;
  name: string;
  shortName: string;
  isTracked: boolean;
}

/**
 * Sensex and Nifty give the market backdrop; Ola Electric is the only tracked
 * company that is publicly listed. ANI Technologies and Krutrim are private,
 * which is why they are absent rather than shown as empty tiles.
 */
export const INSTRUMENTS: Instrument[] = [
  { key: 'sensex', symbol: '^BSESN', name: 'BSE Sensex', shortName: 'Sensex', isTracked: false },
  { key: 'nifty', symbol: '^NSEI', name: 'Nifty 50', shortName: 'Nifty 50', isTracked: false },
  { key: 'olaelectric', symbol: 'OLAELEC.NS', name: 'Ola Electric Mobility', shortName: 'Ola Electric', isTracked: true },
];

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Quotes change slowly relative to page views, and the upstream is an
 * undocumented courtesy endpoint — so results are cached briefly rather than
 * re-fetched per request. The cache is per instance, which is the right
 * granularity on serverless.
 */
const CACHE_TTL_MS = Number(process.env.OLA_NEWS_MARKET_CACHE_MS ?? 300_000);
let cache: { at: number; snapshot: MarketSnapshot } | null = null;

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string } | null;
  };
}

async function fetchInstrument(
  instrument: Instrument,
  range: string,
): Promise<MarketQuote> {
  const base: MarketQuote = {
    key: instrument.key,
    symbol: instrument.symbol,
    name: instrument.name,
    shortName: instrument.shortName,
    currency: 'INR',
    exchange: '',
    price: null,
    previousClose: null,
    change: null,
    changePercent: null,
    series: [],
    isTracked: instrument.isTracked,
    fetchedAt: new Date().toISOString(),
  };

  try {
    const url = `${CHART_BASE}/${encodeURIComponent(instrument.symbol)}?range=${range}&interval=1d`;
    const { body } = await fetchWithRetry(
      url,
      { timeoutMs: 12_000, retries: 1, accept: 'application/json' },
      1200,
    );

    const payload = JSON.parse(body) as YahooChart;
    if (payload.chart?.error) {
      throw new Error(payload.chart.error.description ?? 'Upstream reported an error');
    }

    const result = payload.chart?.result?.[0];
    if (!result?.meta) throw new Error('No data returned for this symbol');

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const series: MarketSeriesPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      // Holidays and halts come back as null; drop them rather than plotting a gap at zero.
      if (typeof close === 'number' && Number.isFinite(close)) {
        series.push({ t: timestamps[i], c: Number(close.toFixed(2)) });
      }
    }

    const price = result.meta.regularMarketPrice ?? series.at(-1)?.c ?? null;
    const previousClose =
      result.meta.chartPreviousClose ?? result.meta.previousClose ?? series.at(-2)?.c ?? null;

    const change = price !== null && previousClose !== null ? price - previousClose : null;
    const changePercent =
      change !== null && previousClose ? (change / previousClose) * 100 : null;

    return {
      ...base,
      currency: result.meta.currency ?? 'INR',
      exchange: result.meta.fullExchangeName ?? '',
      price,
      previousClose,
      change: change === null ? null : Number(change.toFixed(2)),
      changePercent: changePercent === null ? null : Number(changePercent.toFixed(2)),
      series,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.warn('market quote failed', { symbol: instrument.symbol, message });
    return { ...base, error: message };
  }
}

export async function getMarketSnapshot(
  { range = '1mo', force = false }: { range?: string; force?: boolean } = {},
): Promise<MarketSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.snapshot;

  const quotes = await Promise.all(
    INSTRUMENTS.map((instrument) => fetchInstrument(instrument, range)),
  );

  const allFailed = quotes.every((quote) => quote.error);
  const snapshot: MarketSnapshot = {
    quotes,
    error: allFailed
      ? 'Market data is temporarily unavailable. The prices shown elsewhere on this page are unaffected.'
      : undefined,
    source: 'Yahoo Finance (delayed, indicative)',
    disclaimer:
      'Indicative and delayed. Shown for context alongside the news, not for trading decisions, ' +
      'and not investment advice.',
  };

  // A total failure is not cached, so the next view retries immediately.
  if (!allFailed) cache = { at: Date.now(), snapshot };
  return snapshot;
}

/** Test/diagnostic helper. */
export function resetMarketCache() {
  cache = null;
}

/**
 * Rebases each series to 100 at its first point so instruments of wildly
 * different magnitudes (a 77,000-point index and a ₹38 share) can be compared
 * on one axis. This is what makes "is the company moving with the market or
 * against it?" readable at a glance.
 */
export function toRelativePerformance(
  quotes: MarketQuote[],
): Array<Record<string, number | string>> {
  const usable = quotes.filter((quote) => quote.series.length > 1);
  if (usable.length === 0) return [];

  // Align on the shortest series so every line covers the same window.
  const length = Math.min(...usable.map((quote) => quote.series.length));
  const rows: Array<Record<string, number | string>> = [];

  for (let i = 0; i < length; i++) {
    const row: Record<string, number | string> = {};
    for (const quote of usable) {
      const offset = quote.series.length - length;
      const point = quote.series[offset + i];
      const first = quote.series[offset];
      if (i === 0) row.date = new Date(point.t * 1000).toISOString().slice(0, 10);
      if (first.c !== 0) {
        row[quote.key] = Number(((point.c / first.c) * 100).toFixed(2));
      }
    }
    row.date = new Date(usable[0].series[usable[0].series.length - length + i].t * 1000)
      .toISOString()
      .slice(0, 10);
    rows.push(row);
  }
  return rows;
}
