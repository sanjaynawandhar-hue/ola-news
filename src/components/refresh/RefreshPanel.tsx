'use client';

import { CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { useRefresh } from './RefreshProvider';
import { Badge, Button, Modal, ProgressBar } from '@/components/ui';
import { SourceModeBadge } from '@/components/ui/badges';
import { formatDateTime, formatTimeZoneAbbr } from '@/lib/time';
import { useSettings } from '@/components/providers';
import type { SourceProgress } from '@/types';

const STATUS_ICON: Record<SourceProgress['status'], React.ReactNode> = {
  pending: <CircleDashed className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" aria-hidden="true" />,
  ok: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
  failed: <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />,
  skipped: <MinusCircle className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />,
};

/**
 * Live refresh progress. Shows exactly what happened per source, including
 * failures — a source that could not be reached is reported as failed rather
 * than being hidden or filled with placeholder results.
 */
export function RefreshPanel() {
  const { job, failures, panelOpen, setPanelOpen, running, lastSuccessAt } = useRefresh();
  const { settings } = useSettings();

  const progress = job?.progress ?? [];
  const completed = job?.sourcesCompleted ?? 0;
  const total = job?.sourcesTotal ?? 0;

  return (
    <Modal
      open={panelOpen}
      onClose={() => setPanelOpen(false)}
      title={running ? 'Refreshing news…' : 'Refresh summary'}
      description={
        running
          ? 'Contacting every enabled source. You can keep working — this panel updates live.'
          : job
            ? `Finished ${formatDateTime(job.finishedAt ?? job.startedAt, settings.timezone)} ${formatTimeZoneAbbr(settings.timezone)}`
            : 'No refresh has run in this session yet.'
      }
      size="lg"
      footer={
        <>
          <p className="mr-auto text-xs text-subtle">
            Last successful refresh:{' '}
            {lastSuccessAt
              ? `${formatDateTime(lastSuccessAt, settings.timezone)} ${formatTimeZoneAbbr(settings.timezone)}`
              : 'never'}
          </p>
          <Button variant="secondary" onClick={() => setPanelOpen(false)}>
            Close
          </Button>
        </>
      }
    >
      {job ? (
        <div className="space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium">
                {completed} of {total} source{total === 1 ? '' : 's'} checked
              </span>
              <StatusPill status={job.status} />
            </div>
            <ProgressBar
              value={total > 0 ? completed : running ? 4 : 100}
              max={total > 0 ? total : 100}
              tone={job.status === 'FAILED' ? 'negative' : job.sourcesFailed > 0 ? 'warning' : 'accent'}
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Items fetched" value={job.itemsFetched} />
            <Metric label="New items stored" value={job.itemsNew} tone="accent" />
            <Metric label="Duplicates removed" value={job.duplicatesRemoved} />
            <Metric label="Source failures" value={job.sourcesFailed} tone={job.sourcesFailed ? 'negative' : undefined} />
          </dl>

          {job.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              {job.error}
            </p>
          ) : null}

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              Sources
            </h4>
            <ul className="scroll-thin max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
              {progress.length === 0 ? (
                <li className="p-3 text-xs text-subtle">Preparing source list…</li>
              ) : (
                progress.map((source) => (
                  <li key={source.sourceKey} className="flex items-start gap-3 p-3">
                    <span className="mt-0.5">{STATUS_ICON[source.status]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{source.sourceName}</span>
                        <SourceModeBadge mode={source.mode} />
                      </div>
                      {source.status === 'ok' ? (
                        <p className="mt-0.5 text-xs text-subtle">
                          {source.itemsFetched} fetched · {source.itemsNew} new ·{' '}
                          {source.duplicates} duplicate(s)
                          {source.durationMs ? ` · ${(source.durationMs / 1000).toFixed(1)}s` : ''}
                          {source.message ? ` · ${source.message}` : ''}
                        </p>
                      ) : source.message ? (
                        <p
                          className={
                            'mt-0.5 text-xs ' +
                            (source.status === 'failed'
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-subtle')
                          }
                        >
                          {source.message}
                          {source.statusCode ? ` (HTTP ${source.statusCode})` : ''}
                        </p>
                      ) : source.status === 'running' ? (
                        <p className="mt-0.5 text-xs text-subtle">Checking…</p>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {failures.length > 0 ? (
            <details className="rounded-lg border border-[var(--border)] p-3">
              <summary className="cursor-pointer text-xs font-semibold">
                Failure log ({failures.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {failures.map((failure, index) => (
                  <li key={`${failure.sourceKey}-${index}`} className="text-xs text-muted">
                    <span className="font-medium">{failure.sourceName}</span> · {failure.stage} ·{' '}
                    {failure.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-subtle">Start a refresh to see live progress here.</p>
      )}
    </Modal>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'accent' | 'negative' }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5">
      <dt className="text-[11px] text-subtle">{label}</dt>
      <dd
        className={
          'mt-0.5 text-lg font-semibold tabular-nums ' +
          (tone === 'accent'
            ? 'text-[var(--accent)]'
            : tone === 'negative'
              ? 'text-[var(--color-negative)]'
              : '')
        }
      >
        {value}
      </dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: 'positive' | 'negative' | 'warning' | 'info'; label: string }> = {
    RUNNING: { tone: 'info', label: 'Running' },
    COMPLETED: { tone: 'positive', label: 'Completed' },
    COMPLETED_WITH_ERRORS: { tone: 'warning', label: 'Completed with errors' },
    FAILED: { tone: 'negative', label: 'Failed' },
    CANCELLED: { tone: 'neutral' as never, label: 'Cancelled' },
  };
  const entry = map[status] ?? { tone: 'info' as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
