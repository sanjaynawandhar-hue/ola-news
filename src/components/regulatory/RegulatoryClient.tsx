'use client';

import * as React from 'react';
import { AlertTriangle, CalendarClock, ExternalLink, FileCheck2, Landmark, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, InfoTip, Select, Skeleton } from '@/components/ui';
import { DemoBadge } from '@/components/ui/badges';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useApi } from '@/hooks/useApi';
import { useSettings } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { useNow } from '@/hooks/useNow';
import { formatDate, formatTimeZoneAbbr, relativeTime } from '@/lib/time';
import {
  REGULATORY_DOC_TYPES, REGULATORY_DOC_TYPE_LABELS, REGULATORY_STATUSES, SEVERITIES,
  type RegulatoryDocType, type Severity,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Paged, RegulatoryItem } from '@/types';

const SEVERITY_TONE: Record<Severity, 'positive' | 'warning' | 'negative'> = {
  LOW: 'positive', MEDIUM: 'warning', HIGH: 'negative', CRITICAL: 'negative',
};

const SEVERITY_RAIL: Record<Severity, string> = {
  LOW: 'before:bg-[var(--color-riskLow)]',
  MEDIUM: 'before:bg-[var(--color-riskMedium)]',
  HIGH: 'before:bg-[var(--color-riskHigh)]',
  CRITICAL: 'before:bg-[var(--color-riskCritical)]',
};

export function RegulatoryClient() {
  const { settings } = useSettings();
  const { dataVersion } = useRefresh();
  const tz = formatTimeZoneAbbr(settings.timezone);

  const [authorities, setAuthorities] = React.useState<string[]>([]);
  const [docTypes, setDocTypes] = React.useState<string[]>([]);
  const [severities, setSeverities] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [trackedOnly, setTrackedOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const params = new URLSearchParams();
  if (authorities.length) params.set('authorities', authorities.join(','));
  if (docTypes.length) params.set('docTypes', docTypes.join(','));
  if (severities.length) params.set('severities', severities.join(','));
  if (status) params.set('statuses', status);
  if (search.trim()) params.set('q', search.trim());
  if (trackedOnly) params.set('trackedOnly', 'true');
  params.set('page', String(page));
  params.set('pageSize', '25');

  const { data, loading, error, reload } = useApi<Paged<RegulatoryItem>>(
    `/api/regulatory?${params.toString()}`,
    [dataVersion],
  );
  const { data: filters } = useApi<{ authorities: Array<{ key: string; count: number }> }>(
    '/api/filters',
    [dataVersion],
  );

  const items = data?.items ?? [];
  // Read the clock from a hook so the render stays pure and deadlines re-evaluate
  // on their own without a reload.
  const now = useNow();
  const openItems = items.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS');
  const dueSoon = items.filter(
    (i) => i.responseDeadline && new Date(i.responseDeadline).getTime() - now < 14 * 86400000 &&
      new Date(i.responseDeadline).getTime() > now,
  );
  const overdue = items.filter(
    (i) => i.responseDeadline && new Date(i.responseDeadline).getTime() < now &&
      (i.status === 'OPEN' || i.status === 'IN_PROGRESS'),
  );
  const critical = items.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH');

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setPage(1);
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Landmark className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Regulatory tracker
        </h1>
        <p className="mt-0.5 max-w-3xl text-xs text-subtle">
          Notices, circulars, orders, investigations, penalties, filings, court matters and policy
          announcements <strong>affecting ANI Technologies, Ola Electric, Krutrim or their
          executives</strong>. Official primary documents rank above secondary news reporting.{' '}
          <InfoTip label="Where a regulator publishes a machine-readable feed (for example SEBI), the original document is collected directly. Sources that block automated collection or publish no feed are listed as disabled on the Sources page rather than being scraped." />
        </p>
      </div>

      <section aria-label="Regulatory metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Tracked items" value={data?.total ?? 0} loading={loading}
          sublabel="matching current filters"
          tooltip="All regulatory documents stored for the tracked companies, from official and secondary sources."
        />
        <KpiCard
          label="Open / in progress" value={openItems.length} loading={loading} tone="accent"
          sublabel="on this page"
          tooltip="Items whose internal status is still Open or In progress."
        />
        <KpiCard
          label="Deadline within 14 days" value={dueSoon.length} loading={loading} tone="warning"
          sublabel={overdue.length ? `${overdue.length} overdue` : 'none overdue'}
          tooltip="Items with a response deadline falling inside the next 14 days."
          icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
        />
        <KpiCard
          label="High / critical severity" value={critical.length} loading={loading} tone="negative"
          sublabel="on this page"
          tooltip="Severity is set per document and reflects the potential compliance and reputational consequence."
          icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </section>

      {overdue.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>{overdue.length} item(s) have passed their response deadline</strong> and are still
            marked open or in progress. Review them below.
          </p>
        </div>
      ) : null}

      <div className="flex gap-5">
        <aside className="hidden w-60 shrink-0 xl:block">
          <Card className="sticky top-20 space-y-3 p-3">
            <div>
              <label htmlFor="reg-search" className="mb-1 block text-xs font-semibold">Search</label>
              <Input
                id="reg-search"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Title, summary, authority…"
              />
            </div>

            <div>
              <label htmlFor="reg-status" className="mb-1 block text-xs font-semibold">Status</label>
              <Select
                id="reg-status"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value);
                }}
                className="w-full"
              >
                <option value="">All statuses</option>
                {REGULATORY_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value.replace('_', ' ').toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>

            <fieldset>
              <legend className="mb-1 text-xs font-semibold">Scope</legend>
              <Checkbox
                label="Only items naming a tracked company"
                checked={trackedOnly}
                onChange={(event) => {
                  setPage(1);
                  setTrackedOnly(event.target.checked);
                }}
              />
              <p className="mt-1 text-[10.5px] text-subtle">
                Everything here already concerns the tracked portfolio — enforcement against
                unrelated parties is filtered out at collection. This narrows further to documents
                that name a tracked company outright, hiding general obligations that reach it as a
                listed issuer or sector participant.
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-xs font-semibold">Issuing authority</legend>
              <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto pr-1">
                {(filters?.authorities ?? []).map((authority) => (
                  <Checkbox
                    key={authority.key}
                    label={`${authority.key} (${authority.count})`}
                    checked={authorities.includes(authority.key)}
                    onChange={() => toggle(authorities, setAuthorities, authority.key)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-xs font-semibold">Document type</legend>
              <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
                {REGULATORY_DOC_TYPES.map((type) => (
                  <Checkbox
                    key={type}
                    label={REGULATORY_DOC_TYPE_LABELS[type]}
                    checked={docTypes.includes(type)}
                    onChange={() => toggle(docTypes, setDocTypes, type)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-xs font-semibold">Severity</legend>
              {SEVERITIES.map((severity) => (
                <Checkbox
                  key={severity}
                  label={severity.charAt(0) + severity.slice(1).toLowerCase()}
                  checked={severities.includes(severity)}
                  onChange={() => toggle(severities, setSeverities, severity)}
                />
              ))}
            </fieldset>

            {authorities.length || docTypes.length || severities.length || status || search || trackedOnly ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAuthorities([]); setDocTypes([]); setSeverities([]);
                  setStatus(''); setSearch(''); setTrackedOnly(false); setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </Card>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          {error ? <ErrorState title="Could not load regulatory items" message={error} onRetry={reload} /> : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-40 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 className="h-6 w-6" aria-hidden="true" />}
              title="Nothing currently affects the tracked companies"
              description="This tracker only holds documents that name ANI Technologies, Ola Electric, Krutrim or a tracked executive, or that bind them as a listed issuer or sector participant. A regulator's feed is mostly enforcement against unrelated parties — recovery certificates, demat attachments, appeals by named individuals — and that is filtered out rather than listed here. SEBI is collected live; MoRTH, BSE, NSE, MCA, PIB and court sources block automated collection or publish no machine-readable feed, so their coverage is limited."
            />
          ) : (
            items.map((item) => (
              <RegulatoryCard
                key={item.id}
                item={item}
                timezone={settings.timezone}
                tz={tz}
                now={now}
              />
            ))
          )}

          {data && data.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 py-3">
              <p className="text-[11px] text-subtle">
                Page {data.page} of {data.totalPages} · {data.total.toLocaleString('en-IN')} items
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline" disabled={data.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm" variant="outline" disabled={data.page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RegulatoryCard({
  item, timezone, tz, now,
}: {
  item: RegulatoryItem;
  timezone: string;
  tz: string;
  now: number;
}) {
  const deadlineMs = item.responseDeadline ? new Date(item.responseDeadline).getTime() : null;
  const overdue =
    deadlineMs !== null && deadlineMs < now && (item.status === 'OPEN' || item.status === 'IN_PROGRESS');
  const dueSoon = deadlineMs !== null && !overdue && deadlineMs - now < 14 * 86400000;

  return (
    <article
      className={cn(
        'surface relative overflow-hidden rounded-xl p-4',
        'before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""]',
        SEVERITY_RAIL[item.severity],
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{item.authority}</Badge>
        <Badge>{REGULATORY_DOC_TYPE_LABELS[item.docType as RegulatoryDocType] ?? item.docTypeLabel}</Badge>
        <Badge tone={SEVERITY_TONE[item.severity]}>severity: {item.severity.toLowerCase()}</Badge>
        <Badge tone={item.status === 'CLOSED' ? 'neutral' : 'info'}>
          {item.status.replace('_', ' ').toLowerCase()}
        </Badge>
        {item.isPrimaryDocument ? (
          <Badge tone="positive" title="Collected from the issuing authority itself, not from secondary reporting.">
            official document
          </Badge>
        ) : (
          <Badge tone="warning" title="Secondary reporting about a regulatory matter. Prefer the original document.">
            secondary reporting
          </Badge>
        )}
        {item.companyKeys.length === 0 ? (
          <Badge
            tone="neutral"
            title="Does not name a tracked company, but binds it — as a listed issuer, or as a participant in a regulated sector. Documents with no such connection are not stored at all."
          >
            applies by category
          </Badge>
        ) : (
          <Badge tone="accent" title="This document names a tracked company or executive.">
            names a tracked company
          </Badge>
        )}
        {item.isDemo ? <DemoBadge /> : null}
      </div>

      <h3 className="text-[15px] font-semibold leading-snug tracking-tight">{item.title}</h3>

      <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.summary}</p>

      {item.whyItMatters ? (
        <div className="mt-2 rounded-lg bg-[var(--bg-inset)] p-2.5">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ola-700)] dark:text-[var(--color-ola-300)]">
            Why this matters
          </p>
          <p className="text-[13px] leading-relaxed text-muted">{item.whyItMatters}</p>
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="uppercase tracking-wide text-subtle">Issue date</dt>
          <dd className="font-medium">{formatDate(item.issueDate, timezone)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-subtle">Effective date</dt>
          <dd className="font-medium">
            {item.effectiveDate ? formatDate(item.effectiveDate, timezone) : '—'}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-subtle">Response deadline</dt>
          <dd
            className={cn(
              'font-medium',
              overdue && 'text-[var(--color-negative)]',
              dueSoon && !overdue && 'text-[var(--color-riskHigh)]',
            )}
          >
            {item.responseDeadline ? (
              <>
                {formatDate(item.responseDeadline, timezone)}
                <span className="ml-1 font-normal">
                  ({overdue ? 'overdue ' : ''}
                  {relativeTime(item.responseDeadline)})
                </span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-subtle">Source</dt>
          <dd className="truncate font-medium" title={item.sourceName}>{item.sourceName}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10.5px] text-subtle">All dates shown in {tz}</p>
        <a href={item.documentUrl} target="_blank" rel="noopener noreferrer nofollow">
          <Button size="sm" variant="outline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Official document
          </Button>
        </a>
      </div>
    </article>
  );
}
