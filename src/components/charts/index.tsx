'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { COMPANY_GROUP_SHORT, type CompanyGroup } from '@/lib/constants';
import type { TrendPoint } from '@/lib/intelligence/trends';

/**
 * Chart palette. Categorical hues are chosen to stay distinguishable in both
 * themes and for the most common forms of colour-vision deficiency; every
 * series is also labelled in the legend and tooltip, never colour-only.
 */
export const SERIES_COLORS = {
  total: '#0BA860',
  positive: '#0F9D58',
  neutral: '#94A3B8',
  negative: '#D93025',
  ani: '#0BA860',
  olaelectric: '#0369A1',
  krutrim: '#9333EA',
  market: '#94A3B8',
};

const AXIS = { stroke: 'var(--border)', tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs shadow-lg">
      {label !== undefined ? <p className="mb-1 font-semibold">{label}</p> : null}
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-1.5 text-muted">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          <span>{entry.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums text-[var(--fg)]">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Trend keys are YYYY-MM-DD; show DD/MM, which reads naturally in IST. */
function shortDate(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  const [, month, day] = value.split('-');
  return day && month ? `${day}/${month}` : value;
}

export function VolumeTrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS.total} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES_COLORS.total} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
        <YAxis allowDecimals={false} width={44} {...AXIS} />
        <Tooltip content={<ChartTooltip />} labelFormatter={shortDate} />
        <Area
          type="monotone" dataKey="total" name="Stories"
          stroke={SERIES_COLORS.total} strokeWidth={2} fill="url(#volumeFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SentimentTrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
        <YAxis allowDecimals={false} width={44} {...AXIS} />
        <Tooltip content={<ChartTooltip />} labelFormatter={shortDate} />
        <Legend iconType="circle" iconSize={7} />
        <Line type="monotone" dataKey="positive" name="Positive" stroke={SERIES_COLORS.positive} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="neutral" name="Neutral" stroke={SERIES_COLORS.neutral} strokeWidth={2} dot={false} strokeDasharray="4 3" />
        <Line type="monotone" dataKey="negative" name="Negative" stroke={SERIES_COLORS.negative} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompanyTrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }} stackOffset="none">
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
        <YAxis allowDecimals={false} width={44} {...AXIS} />
        <Tooltip content={<ChartTooltip />} labelFormatter={shortDate} />
        <Legend iconType="circle" iconSize={7} />
        {(['ani', 'olaelectric', 'krutrim', 'market'] as CompanyGroup[]).map((group) => (
          <Area
            key={group} type="monotone" dataKey={group} stackId="1"
            name={COMPANY_GROUP_SHORT[group]}
            stroke={SERIES_COLORS[group]} fill={SERIES_COLORS[group]} fillOpacity={0.22} strokeWidth={1.6}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ComparisonChart({
  data, height = 280,
}: {
  data: Array<{ label: string; positive: number; negative: number; highRisk: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={0} tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} width={44} {...AXIS} />
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={7} />
        <Bar dataKey="positive" name="Positive" fill={SERIES_COLORS.positive} radius={[3, 3, 0, 0]} />
        <Bar dataKey="negative" name="Negative" fill={SERIES_COLORS.negative} radius={[3, 3, 0, 0]} />
        <Bar dataKey="highRisk" name="High / critical risk" fill="#EE6C1F" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({
  data, height = 300,
}: {
  data: Array<{ label: string; count: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} {...AXIS} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-subtle)' }} />
        <Bar dataKey="count" name="Stories" fill={SERIES_COLORS.total} radius={[0, 3, 3, 0]} barSize={13} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SentimentDonut({
  positive, neutral, negative, height = 210,
}: {
  positive: number;
  neutral: number;
  negative: number;
  height?: number;
}) {
  const data = [
    { name: 'Positive', value: positive, color: SERIES_COLORS.positive },
    { name: 'Neutral', value: neutral, color: SERIES_COLORS.neutral },
    { name: 'Negative', value: negative, color: SERIES_COLORS.negative },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="flex items-center justify-center text-xs text-subtle" style={{ height }}>
        No stories in this period.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} stroke="var(--bg-elevated)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={7} />
      </PieChart>
    </ResponsiveContainer>
  );
}
