'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, KeyRound, Radio, RefreshCw, ShieldQuestion } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, Skeleton, Toggle, Tabs } from '@/components/ui';
import { SourceModeBadge } from '@/components/ui/badges';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useApi, mutate } from '@/hooks/useApi';
import { useSettings, useToast } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { formatDateTime, formatTimeZoneAbbr, relativeTime } from '@/lib/time';
import { SOURCE_TYPE_LABELS, type SourceMode, type SourceType } from '@/lib/constants';

interface SourceRow {
  id: string;
  key: string;
  name: string;
  homepage: string | null;
  endpoint: string | null;
  adapter: string;
  sourceType: SourceType;
  group: string | null;
  country: string;
  language: string;
  credibility: number;
  mode: SourceMode;
  effectiveMode: SourceMode;
  enabled: boolean;
  requiresCredential: boolean;
  credentialEnvVar: string | null;
  credentialPresent: boolean;
  isRegulatory: boolean;
  authority: string | null;
  termsUrl: string | null;
  complianceNote: string | null;
  articleCount: number;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  recentFailures: Array<{ message: string; statusCode: number | null; occurredAt: string }>;
}

interface SourcesResponse {
  items: SourceRow[];
  credentials: Array<{ envVar: string; configured: boolean }>;
}

export function SourcesClient() {
  const { settings } = useSettings();
  const { push } = useToast();
  const { dataVersion, start, running } = useRefresh();
  const { data, loading, error, reload } = useApi<SourcesResponse>('/api/sources', [dataVersion]);
  const [filter, setFilter] = React.useState('all');
  const [busy, setBusy] = React.useState<string | null>(null);

  const tz = formatTimeZoneAbbr(settings.timezone);
  const sources = data?.items ?? [];

  /**
   * Each connector falls into exactly one bucket, so the tiles sum to the total.
   * A disabled connector is reported as DISABLED whatever its mode says —
   * previously a switched-off demo source was counted as both DEMO and
   * DISABLED, which made it look as though sample data were still running.
   */
  const bucketOf = (source: SourceRow): 'LIVE' | 'DEMO' | 'AWAITING_CREDENTIALS' | 'DISABLED' => {
    if (!source.enabled || source.effectiveMode === 'DISABLED') return 'DISABLED';
    if (source.effectiveMode === 'AWAITING_CREDENTIALS') return 'AWAITING_CREDENTIALS';
    if (source.effectiveMode === 'DEMO') return 'DEMO';
    return 'LIVE';
  };

  const counts = {
    all: sources.length,
    LIVE: sources.filter((s) => bucketOf(s) === 'LIVE').length,
    DEMO: sources.filter((s) => bucketOf(s) === 'DEMO').length,
    AWAITING_CREDENTIALS: sources.filter((s) => bucketOf(s) === 'AWAITING_CREDENTIALS').length,
    DISABLED: sources.filter((s) => bucketOf(s) === 'DISABLED').length,
  };

  const visible = sources.filter((source) => {
    if (filter === 'all') return true;
    if (filter === 'failing') return source.consecutiveFailures > 0;
    return bucketOf(source) === filter;
  });

  const grouped = visible.reduce<Record<string, SourceRow[]>>((acc, source) => {
    const key = source.group ?? 'Other';
    (acc[key] ??= []).push(source);
    return acc;
  }, {});

  const toggleSource = async (source: SourceRow, enabled: boolean) => {
    setBusy(source.key);
    try {
      await mutate('/api/sources', { method: 'PATCH', body: { key: source.key, enabled } });
      reload();
      push({
        tone: 'success',
        title: enabled ? `${source.name} enabled` : `${source.name} disabled`,
      });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not update this source',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <Radio className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            Sources
          </h1>
          <p className="mt-0.5 max-w-3xl text-xs text-subtle">
            Every connector and its true status. Only headline, publisher-provided description, link
            and metadata are stored — full article text is never copied, paywalls are never bypassed,
            and each request declares an identifying user agent and honours per-host rate limits.
          </p>
        </div>
        <Button variant="primary" onClick={() => void start()} disabled={running}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {running ? 'Refreshing…' : 'Run refresh now'}
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total connectors" value={counts.all} loading={loading}
          tooltip="Every source adapter configured in this deployment." />
        <KpiCard label="Live" value={counts.LIVE} loading={loading} tone="positive"
          tooltip="Verified reachable and contacted on every refresh." />
        <KpiCard
          label="Demo data" value={counts.DEMO} loading={loading}
          tone={counts.DEMO > 0 ? 'warning' : 'default'}
          sublabel={counts.DEMO === 0 ? 'live sources only' : 'sample dataset active'}
          tooltip="Enabled connectors serving the built-in sample dataset. Sample records are labelled everywhere, including PNG cards and PPTX slides, and are never presented as live news. Zero here means the dashboard is running on live sources only." />
        <KpiCard label="Awaiting credentials" value={counts.AWAITING_CREDENTIALS} loading={loading}
          tooltip="Adapter implemented, but the API key is not present in the server environment. These are skipped, never faked." />
        <KpiCard label="Disabled" value={counts.DISABLED} loading={loading}
          tooltip="Turned off, or blocked by the publisher / with no machine-readable feed available." />
      </section>

      {data?.credentials?.length ? (
        <Card>
          <CardHeader
            title="Credential status"
            description="Read from the server environment. Keys are never sent to the browser."
            tooltip="Only whether each variable is set is exposed to this page — never the value."
          />
          <CardBody className="flex flex-wrap gap-2">
            {data.credentials.map((credential) => (
              <span
                key={credential.envVar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden="true" />
                <code className="font-mono text-[11px]">{credential.envVar}</code>
                {credential.configured ? (
                  <Badge tone="positive">set</Badge>
                ) : (
                  <Badge tone="neutral">not set</Badge>
                )}
              </span>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'LIVE', label: 'Live', count: counts.LIVE },
          { value: 'DEMO', label: 'Demo', count: counts.DEMO },
          { value: 'AWAITING_CREDENTIALS', label: 'Needs credentials', count: counts.AWAITING_CREDENTIALS },
          { value: 'DISABLED', label: 'Disabled', count: counts.DISABLED },
          { value: 'failing', label: 'Failing', count: sources.filter((s) => s.consecutiveFailures > 0).length },
        ]}
        className="max-w-3xl"
      />

      {error ? <ErrorState title="Could not load sources" message={error} onRetry={reload} /> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        Object.entries(grouped).map(([groupName, groupSources]) => (
          <section key={groupName} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">{groupName}</h2>
            <div className="space-y-2">
              {groupSources.map((source) => (
                <Card key={source.key} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-semibold">{source.name}</h3>
                        <SourceModeBadge mode={source.effectiveMode} />
                        <Badge>{SOURCE_TYPE_LABELS[source.sourceType]}</Badge>
                        {source.isRegulatory ? <Badge tone="accent">regulatory</Badge> : null}
                        {source.consecutiveFailures > 0 ? (
                          <Badge tone="negative">
                            {source.consecutiveFailures} consecutive failure(s)
                          </Badge>
                        ) : null}
                      </div>

                      {source.complianceNote ? (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted">
                          <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {source.complianceNote}
                        </p>
                      ) : null}

                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
                        <Meta label="Adapter" value={source.adapter} />
                        <Meta label="Credibility" value={`${source.credibility}/100`} />
                        <Meta label="Stories stored" value={source.articleCount.toLocaleString('en-IN')} />
                        <Meta
                          label="Last success"
                          value={source.lastSuccessAt ? relativeTime(source.lastSuccessAt) : 'never'}
                          title={
                            source.lastSuccessAt
                              ? `${formatDateTime(source.lastSuccessAt, settings.timezone)} ${tz}`
                              : undefined
                          }
                        />
                      </dl>

                      {source.lastError ? (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            <strong>Last error</strong>
                            {source.lastErrorAt ? ` (${relativeTime(source.lastErrorAt)})` : ''}:{' '}
                            {source.lastError}
                          </span>
                        </p>
                      ) : source.lastSuccessAt && source.consecutiveFailures === 0 ? (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Healthy — last successful collection {relativeTime(source.lastSuccessAt)}.
                        </p>
                      ) : null}

                      {source.requiresCredential && !source.credentialPresent ? (
                        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                          Set <code className="font-mono">{source.credentialEnvVar}</code> in the
                          server environment, then restart, to enable this source.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Toggle
                        label="Enabled"
                        checked={source.enabled}
                        disabled={
                          busy === source.key ||
                          (source.requiresCredential && !source.credentialPresent)
                        }
                        onChange={(next) => void toggleSource(source, next)}
                      />
                      <div className="flex gap-1.5">
                        {source.homepage ? (
                          <a href={source.homepage} target="_blank" rel="noopener noreferrer nofollow">
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              Site
                            </Button>
                          </a>
                        ) : null}
                        {source.termsUrl ? (
                          <a href={source.termsUrl} target="_blank" rel="noopener noreferrer nofollow">
                            <Button size="sm" variant="ghost">Terms</Button>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="truncate font-medium" title={title ?? value}>{value}</dd>
    </div>
  );
}
