'use client';

import { Badge, InfoTip } from './index';
import { VERIFICATION_LABELS, type RiskLevel, type Sentiment, type SourceMode, type VerificationStatus } from '@/lib/constants';
import { cn } from '@/lib/utils';

/** Domain-specific badges, so sentiment/risk/verification look identical everywhere. */

export function SentimentBadge({ value, score }: { value: Sentiment; score?: number }) {
  const tone = value === 'POSITIVE' ? 'positive' : value === 'NEGATIVE' ? 'negative' : 'neutral';
  return (
    <Badge tone={tone} title={score !== undefined ? `Polarity score ${score.toFixed(2)}` : undefined}>
      {value.toLowerCase()}
    </Badge>
  );
}

const RISK_TONE: Record<RiskLevel, 'neutral' | 'positive' | 'warning' | 'negative'> = {
  NONE: 'neutral',
  LOW: 'positive',
  MEDIUM: 'warning',
  HIGH: 'negative',
  CRITICAL: 'negative',
};

export function RiskBadge({ value, score }: { value: RiskLevel; score?: number }) {
  return (
    <Badge
      tone={RISK_TONE[value]}
      className={value === 'CRITICAL' ? 'ring-1 ring-red-400 dark:ring-red-700' : undefined}
      title={score !== undefined ? `Risk score ${score}/100` : undefined}
    >
      risk: {value.toLowerCase()}
    </Badge>
  );
}

export function VerificationBadge({ value, corroboration }: { value: VerificationStatus; corroboration?: number }) {
  const tone =
    value === 'OFFICIAL' ? 'accent' : value === 'CORROBORATED' ? 'positive' : value === 'SINGLE_SOURCE' ? 'info' : 'neutral';
  return (
    <Badge
      tone={tone}
      title={
        corroboration !== undefined
          ? `${corroboration} independent publisher(s) carrying this story`
          : undefined
      }
    >
      {VERIFICATION_LABELS[value]}
    </Badge>
  );
}

const MODE_TONE: Record<SourceMode, 'positive' | 'demo' | 'neutral' | 'warning'> = {
  LIVE: 'positive',
  DEMO: 'demo',
  DISABLED: 'neutral',
  AWAITING_CREDENTIALS: 'warning',
};

const MODE_LABEL: Record<SourceMode, string> = {
  LIVE: 'Live',
  DEMO: 'Demo data',
  DISABLED: 'Disabled',
  AWAITING_CREDENTIALS: 'Needs credentials',
};

export function SourceModeBadge({ mode }: { mode: SourceMode }) {
  return (
    <Badge tone={MODE_TONE[mode]}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          mode === 'LIVE' ? 'bg-emerald-500' : mode === 'DEMO' ? 'bg-amber-500' : mode === 'AWAITING_CREDENTIALS' ? 'bg-amber-500' : 'bg-slate-400',
        )}
      />
      {MODE_LABEL[mode]}
    </Badge>
  );
}

/** Prominent, unmissable marker on any sample record. */
export function DemoBadge() {
  return (
    <Badge tone="demo" title="Sample data included for evaluation. This is not a real news item.">
      Demo data
    </Badge>
  );
}

export function ConfidenceMeter({ value, label = 'Confidence' }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-subtle">
      <span className="inline-flex h-1.5 w-10 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        <span
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
      <span className="tabular-nums">
        {label} {Math.round(value)}%
      </span>
      <InfoTip label="All scores on this dashboard are automated estimates produced from the headline and the publisher's syndicated description. They are not verified facts — always check the original source." />
    </span>
  );
}
