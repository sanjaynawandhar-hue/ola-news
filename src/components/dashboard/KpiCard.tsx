'use client';

import { cn } from '@/lib/utils';
import { InfoTip, Skeleton } from '@/components/ui';

export function KpiCard({
  label, value, sublabel, tooltip, tone = 'default', loading, icon,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  tooltip?: string;
  tone?: 'default' | 'accent' | 'positive' | 'negative' | 'warning';
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const tones = {
    default: 'text-[var(--fg)]',
    accent: 'text-[var(--accent)]',
    positive: 'text-[var(--color-positive)]',
    negative: 'text-[var(--color-negative)]',
    warning: 'text-[var(--color-riskHigh)]',
  };

  return (
    <div className="surface rounded-xl p-3.5 sm:p-4">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-subtle">
          {label}
        </span>
        {tooltip ? <InfoTip label={tooltip} /> : null}
        {icon ? <span className="ml-auto text-[var(--fg-subtle)]">{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem]', tones[tone])}>
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </p>
      )}
      {sublabel ? <p className="mt-0.5 truncate text-[11px] text-subtle">{sublabel}</p> : null}
    </div>
  );
}
