'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoTip, Skeleton } from '@/components/ui';

const TONES = {
  default: 'text-[var(--fg)]',
  accent: 'text-[var(--accent)]',
  positive: 'text-[var(--color-positive)]',
  negative: 'text-[var(--color-negative)]',
  warning: 'text-[var(--color-riskHigh)]',
} as const;

export function KpiCard({
  label, value, sublabel, tooltip, tone = 'default', loading, icon, href, linkLabel,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  tooltip?: string;
  tone?: keyof typeof TONES;
  loading?: boolean;
  icon?: React.ReactNode;
  /**
   * Where this number came from. When set, the whole tile becomes a link to
   * the filtered view that produced it — a metric the reader cannot drill into
   * is just a number they have to take on trust.
   */
  href?: string;
  /** Accessible description of the destination, e.g. "View 35 stories". */
  linkLabel?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-subtle">
          {label}
        </span>
        {/*
          The hint icon is only offered on a tile that does nothing when
          clicked. On a linked tile it competed with the click it sits on: the
          explanation is carried by the link's accessible name instead.
        */}
        {tooltip && !href ? <InfoTip label={tooltip} /> : null}
        <span className="ml-auto flex items-center gap-1 text-[var(--fg-subtle)]">
          {icon}
          {href ? (
            <ArrowUpRight
              className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/kpi:opacity-100 group-focus-visible/kpi:opacity-100"
              aria-hidden="true"
            />
          ) : null}
        </span>
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p
          className={cn(
            'mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem]',
            TONES[tone],
            href && 'underline-offset-4 group-hover/kpi:underline',
          )}
        >
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </p>
      )}

      {sublabel ? <p className="mt-0.5 truncate text-[11px] text-subtle">{sublabel}</p> : null}
    </>
  );

  if (!href) {
    return <div className="surface rounded-xl p-3.5 sm:p-4">{body}</div>;
  }

  return (
    <Link
      href={href}
      aria-label={
        linkLabel
          ? `${linkLabel}${tooltip ? `. ${tooltip}` : ''}`
          : `${label}: ${value}. View the matching stories.`
      }
      className={cn(
        // Named, not a bare `group`: `group-hover:` matches any ancestor with
        // `.group`, so an unnamed one here also triggered every tooltip nested
        // inside the tile whenever the cursor touched the card.
        'surface group/kpi block rounded-xl p-3.5 transition-colors sm:p-4',
        'hover:border-[var(--accent)] focus-visible:border-[var(--accent)]',
      )}
    >
      {body}
    </Link>
  );
}
