'use client';

import * as React from 'react';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, LineChart as LineChartIcon, Minus } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, ErrorState, InfoTip, Select, Skeleton } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

interface MarketSeriesPoint {
  t: number;
  c: number;
}

interface MarketQuote {
  key: string;
  symbol: string;
  name: string;
  shortName: string;
  currency: string;
  exchange: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  series: MarketSeriesPoint[];
  isTracked: boolean;
  fetchedAt: string;
  error?: string;
}

interface MarketResponse {
  quotes: MarketQuote[];
  relative: Array<Record<string, number | string>>;
  error?: string;
  source: string;
  disclaimer: string;
}

const RANGES = [
  { value: '5d', label: 'Last 5 days' },
  { value: '1mo', label: 'Last month' },
  { value: '3mo', label: 'Last 3 months' },
  { value: '6mo', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
];

/** One colour per instrument, consistent between the tiles and the chart. */
const SERIES_COLOR: Record<string, string> = {
  sensex: '#0369A1',
  nifty: '#9333EA',
  olaelectric: '#0BA860',
};

function formatValue(quote: MarketQuote): string {
  if (quote.price === null) return '—';
  // Index levels are large and read better without paise; a share price needs them.
  const decimals = quote.price >= 1000 ? 0 : 2;
  return quote.price.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function MarketPanel() {
  const [range, setRange] = React.useState('1mo');
  const { data, loading, error, reload } = useApi<MarketResponse>(
    `/api/market?range=${range}`,
    [range],
  );

  const quotes = data?.quotes ?? [];
  const tracked = quotes.find((quote) => quote.isTracked);

  return (
    <Card>
      <CardHeader
        title="Market context"
        description="Benchmark indices and the listed tracked company"
        tooltip="Sensex and Nifty give the market backdrop so a move in Ola Electric can be read against it — a fall on a rising market is a company-specific signal, a fall alongside it usually is not. ANI Technologies and Krutrim are privately held and so are not shown."
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="market-range" className="sr-only">Market range</label>
            <Select
              id="market-range"
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="h-8 w-36 text-xs"
            >
              {RANGES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        }
      />
      <CardBody className="space-y-4">
        {error ? (
          <ErrorState title="Could not load market data" message={error} onRetry={reload} />
        ) : null}

        {data?.error ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs text-muted">
            {data.error}
          </p>
        ) : null}

        {/* --- Quote tiles ------------------------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-3">
          {loading && quotes.length === 0
            ? Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))
            : quotes.map((quote) => (
                <QuoteTile key={quote.key} quote={quote} />
              ))}
        </div>

        {/* --- Relative performance ---------------------------------------- */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            <LineChartIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Relative performance
            <InfoTip label="Each line is rebased to 100 at the start of the window, so a ₹38 share and a 77,000-point index can be compared on one axis. A line above 100 has gained over the period; the gap between them is the company's performance relative to the market." />
          </p>
          {loading && !data ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (data?.relative ?? []).length === 0 ? (
            <p className="py-10 text-center text-xs text-subtle">
              No comparable price history available for this range.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data!.relative} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: unknown) =>
                    typeof value === 'string' ? value.slice(5).split('-').reverse().join('/') : ''
                  }
                  stroke="var(--border)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  // Values are rebased to 100, so labels are three digits and
                  // need room — a narrower axis clipped the leading digit.
                  width={52}
                  stroke="var(--border)"
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tickFormatter={(value: number) => `${Math.round(value)}`}
                />
                <Tooltip content={<RelativeTooltip quotes={quotes} />} />
                <Legend iconType="circle" iconSize={7} />
                {quotes
                  .filter((quote) => !quote.error && quote.series.length > 1)
                  .map((quote) => (
                    <Line
                      key={quote.key}
                      type="monotone"
                      dataKey={quote.key}
                      name={quote.shortName}
                      stroke={SERIES_COLOR[quote.key] ?? '#94A3B8'}
                      strokeWidth={quote.isTracked ? 2.4 : 1.6}
                      strokeDasharray={quote.isTracked ? undefined : '4 3'}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* --- Read-through ------------------------------------------------ */}
        {tracked && !tracked.error && data?.relative?.length ? (
          <RelativeReadThrough relative={data.relative} tracked={tracked} quotes={quotes} />
        ) : null}

        <p className="text-[10.5px] text-subtle">
          {data?.source ? `${data.source}. ` : ''}
          {data?.disclaimer ??
            'Indicative and delayed. Shown for context alongside the news, not for trading decisions, and not investment advice.'}
        </p>
      </CardBody>
    </Card>
  );
}

function QuoteTile({ quote }: { quote: MarketQuote }) {
  const pct = quote.changePercent;
  const direction = pct === null ? 'flat' : pct > 0.005 ? 'up' : pct < -0.005 ? 'down' : 'flat';

  const tone =
    direction === 'up'
      ? 'text-[var(--color-positive)]'
      : direction === 'down'
        ? 'text-[var(--color-negative)]'
        : 'text-[var(--fg-muted)]';

  const Arrow = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const color = SERIES_COLOR[quote.key] ?? '#94A3B8';

  if (quote.error) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
        <p className="text-xs font-semibold">{quote.shortName}</p>
        <p className="mt-1 text-[11px] text-[var(--color-negative)]">Unavailable</p>
        <p className="mt-0.5 text-[10.5px] text-subtle">{quote.error.slice(0, 70)}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border p-3',
        quote.isTracked
          ? 'border-[var(--accent)] bg-[var(--bg-inset)]'
          : 'border-[var(--border)] bg-[var(--bg-subtle)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: color }}
              aria-hidden="true"
            />
            {quote.shortName}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] text-subtle">
            {quote.exchange || quote.symbol}
          </p>
        </div>
        {quote.isTracked ? <Badge tone="accent">tracked</Badge> : null}
      </div>

      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight">
        <span className="text-[11px] font-normal text-subtle">{quote.currency} </span>
        {formatValue(quote)}
      </p>

      <p className={cn('mt-0.5 flex items-center gap-1 text-xs font-medium tabular-nums', tone)}>
        <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
        {quote.change === null ? '—' : `${quote.change > 0 ? '+' : ''}${quote.change.toLocaleString('en-IN')}`}
        {pct === null ? '' : ` (${pct > 0 ? '+' : ''}${pct.toFixed(2)}%)`}
      </p>

      {quote.series.length > 1 ? (
        <div className="mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={quote.series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${quote.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Area
                type="monotone"
                dataKey="c"
                stroke={color}
                strokeWidth={1.6}
                fill={`url(#spark-${quote.key})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

function RelativeTooltip({
  active, payload, label, quotes,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  label?: string | number;
  quotes: MarketQuote[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{String(label)}</p>
      {payload.map((entry, index) => {
        const quote = quotes.find((q) => q.key === entry.dataKey);
        const value = typeof entry.value === 'number' ? entry.value : 0;
        const delta = value - 100;
        return (
          <p key={index} className="flex items-center gap-1.5 text-muted">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <span>{quote?.shortName ?? entry.dataKey}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-[var(--fg)]">
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          </p>
        );
      })}
    </div>
  );
}

/**
 * States plainly whether the tracked company out- or under-performed the market
 * over the window. This is the question the chart exists to answer, so it is
 * spelled out rather than left to the reader.
 */
function RelativeReadThrough({
  relative, tracked, quotes,
}: {
  relative: Array<Record<string, number | string>>;
  tracked: MarketQuote;
  quotes: MarketQuote[];
}) {
  const last = relative.at(-1);
  if (!last) return null;

  const companyChange = typeof last[tracked.key] === 'number' ? (last[tracked.key] as number) - 100 : null;
  const benchmarks = quotes.filter((quote) => !quote.isTracked && typeof last[quote.key] === 'number');
  if (companyChange === null || benchmarks.length === 0) return null;

  const benchmarkAvg =
    benchmarks.reduce((sum, quote) => sum + ((last[quote.key] as number) - 100), 0) / benchmarks.length;
  const gap = companyChange - benchmarkAvg;
  const outperformed = gap > 0;

  return (
    <p className="rounded-lg bg-[var(--bg-inset)] p-2.5 text-xs leading-relaxed text-muted">
      Over this window <strong>{tracked.shortName}</strong> moved{' '}
      <strong className={companyChange >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
        {companyChange > 0 ? '+' : ''}{companyChange.toFixed(1)}%
      </strong>{' '}
      against a benchmark average of{' '}
      <strong>{benchmarkAvg > 0 ? '+' : ''}{benchmarkAvg.toFixed(1)}%</strong> —{' '}
      {Math.abs(gap) < 1 ? (
        <>broadly in line with the market.</>
      ) : (
        <>
          {outperformed ? 'outperforming' : 'underperforming'} by{' '}
          <strong className={outperformed ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
            {Math.abs(gap).toFixed(1)} points
          </strong>
          , which points to a company-specific driver rather than a market-wide one.
        </>
      )}
    </p>
  );
}
