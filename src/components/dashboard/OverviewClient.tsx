'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowUpRight, Building2, FileWarning, Flame, Globe2, Newspaper, TrendingUp,
} from 'lucide-react';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, Badge, Skeleton, Tabs, InfoTip } from '@/components/ui';
import { KpiCard } from './KpiCard';
import { MarketPanel } from './MarketPanel';
import { TopList } from './TopList';
import {
  CategoryChart, CompanyTrendChart, ComparisonChart, SentimentDonut, SentimentTrendChart, VolumeTrendChart,
} from '@/components/charts';
import { useApi } from '@/hooks/useApi';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { useSettings } from '@/components/providers';
import { COMPANY_GROUP_LABELS, COMPANY_GROUP_SHORT, type CompanyGroup } from '@/lib/constants';
import { formatDateTime, formatTimeZoneAbbr } from '@/lib/time';
import type { OverviewMetrics } from '@/lib/queries';

const GROUP_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Ola companies' },
  { value: 'ani', label: COMPANY_GROUP_SHORT.ani },
  { value: 'olaelectric', label: COMPANY_GROUP_SHORT.olaelectric },
  { value: 'krutrim', label: COMPANY_GROUP_SHORT.krutrim },
];

const COUNTRY_NAMES: Record<string, string> = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', SG: 'Singapore', AE: 'UAE',
  AU: 'Australia', JP: 'Japan', DE: 'Germany', FR: 'France', CN: 'China', NL: 'Netherlands', CA: 'Canada',
};

export function OverviewClient() {
  const searchParams = useSearchParams();
  const { dataVersion } = useRefresh();
  const { settings } = useSettings();
  const [group, setGroup] = React.useState('all');

  const days = Number(searchParams.get('range') ?? '30') || 30;
  const groupParam = group === 'all' ? '' : `&groups=${group}`;

  const { data, loading, error, reload } = useApi<OverviewMetrics>(
    `/api/overview?days=${days}${groupParam}`,
    [dataVersion, group, days],
  );

  /**
   * Links every tile to the feed view that produced its number, carrying the
   * same company-group and date scope. A metric with no way to drill into it
   * is a number the reader has to take on trust.
   */
  const feedLink = React.useCallback(
    (extra: Record<string, string> = {}, scoped = true) => {
      const params = new URLSearchParams();
      if (group !== 'all') params.set('groups', group);
      // A relative window, not a timestamp: identical on the server and client
      // render, and still correct when the link is shared tomorrow.
      if (scoped) params.set('withinDays', String(days));
      for (const [key, value] of Object.entries(extra)) params.set(key, value);
      const qs = params.toString();
      return `/feed${qs ? `?${qs}` : ''}`;
    },
    [group, days],
  );

  const totals = data?.totals;
  const rangeLabel =
    days === 1 ? 'last 24 hours' : days === 365 ? 'last 12 months' : `last ${days} days`;

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeading rangeLabel={rangeLabel} lastRefreshAt={null} />
        <ErrorState
          title="Could not load the overview"
          message={error}
          onRetry={reload}
        />
      </div>
    );
  }

  const emptyDataset = !loading && totals?.all === 0;

  return (
    <div className="space-y-5">
      <PageHeading rangeLabel={rangeLabel} lastRefreshAt={data?.lastRefreshAt ?? null} />

      {data && data.totals.demo > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>{data.totals.demo}</strong> of the {data.totals.last30d} stories in this period are
            clearly-labelled <strong>demo records</strong>, included so the dashboard is usable without
            paid API credentials. They are sample data, not news. Turn them off in{' '}
            <Link href="/settings" className="underline">Settings</Link> or review connector status on the{' '}
            <Link href="/sources" className="underline">Sources</Link> page.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={GROUP_TABS.map((tab) => ({
            value: tab.value,
            label: tab.label,
            count:
              tab.value === 'all'
                ? data?.totals.last30d
                : data?.byGroup.find((g) => g.group === tab.value)?.total,
          }))}
          value={group}
          onChange={setGroup}
          className="max-w-2xl"
        />
        {/*
          The tabs rescope this page; this opens the same selection as an
          actual list of stories, which is what a reader wants after seeing a
          count they cannot otherwise inspect.
        */}
        <Link
          href={feedLink({ sort: 'recent' })}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[var(--accent)] hover:underline"
        >
          Open these stories in the feed
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {emptyDataset ? (
        <EmptyState
          icon={<Newspaper className="h-6 w-6" aria-hidden="true" />}
          title="No stories collected yet"
          description="Press “Refresh news” in the header to contact the enabled sources for the first time. Live sources are listed on the Sources page."
        />
      ) : null}

      {/* ---------------------------------------------------------- KPIs -- */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total stories" value={totals?.all ?? 0} loading={loading}
          sublabel="All time, after de-duplication"
          tooltip="Every stored story that passed the relevance threshold, across the whole history of this database. Click to open them in the feed."
          icon={<Newspaper className="h-3.5 w-3.5" aria-hidden="true" />}
          href={feedLink({ sort: 'recent' }, false)}
          linkLabel={`View all ${totals?.all ?? 0} stories in the feed`}
        />
        <KpiCard
          label="Last 24 hours" value={totals?.last24h ?? 0} loading={loading} tone="accent"
          sublabel={`${totals?.last7d ?? 0} in 7d · ${totals?.last30d ?? 0} in 30d`}
          tooltip="Stories whose publication timestamp falls within the last 24 hours. Click to open them in the feed."
          href={`/feed?${new URLSearchParams({
            ...(group !== 'all' ? { groups: group } : {}),
            withinDays: '1',
            sort: 'recent',
          }).toString()}`}
          linkLabel={`View the ${totals?.last24h ?? 0} stories from the last 24 hours`}
        />
        <KpiCard
          label="Positive" value={totals?.positive ?? 0} loading={loading} tone="positive"
          sublabel={`in the ${rangeLabel}`}
          tooltip="Automated sentiment estimate from a transparent keyword lexicon. Estimates, not verified facts. Click to open these stories in the feed."
          href={feedLink({ sentiments: 'POSITIVE', sort: 'recent' })}
          linkLabel={`View the ${totals?.positive ?? 0} positive stories`}
        />
        <KpiCard
          label="Negative" value={totals?.negative ?? 0} loading={loading} tone="negative"
          sublabel={`${totals?.neutral ?? 0} neutral`}
          tooltip="Automated sentiment estimate. A story is only labelled positive or negative when enough sentiment-bearing terms are present. Click to open these stories in the feed."
          href={feedLink({ sentiments: 'NEGATIVE', sort: 'recent' })}
          linkLabel={`View the ${totals?.negative ?? 0} negative stories`}
        />
        <KpiCard
          label="High / critical risk" value={totals?.highRisk ?? 0} loading={loading} tone="warning"
          sublabel={`${totals?.criticalAlerts ?? 0} critical`}
          tooltip="Risk level is estimated from explicit driver keywords (recalls, regulatory action, litigation, financial stress and others), weighted by sentiment and relevance. Click to open these stories in the feed."
          icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
          href={feedLink({ riskLevels: 'HIGH,CRITICAL', sort: 'risk' })}
          linkLabel={`View the ${totals?.highRisk ?? 0} high and critical risk stories`}
        />
        <KpiCard
          label="Regulatory items" value={totals?.regulatory ?? 0} loading={loading}
          sublabel="from official sources"
          tooltip="Documents from a regulator, exchange, court or ministry that name a tracked company or bind it as a listed issuer or sector participant. Click to open the regulatory tracker."
          href="/regulatory"
          linkLabel={`View the ${totals?.regulatory ?? 0} regulatory documents`}
        />
      </section>

      {/* ------------------------------------------------- Volume spike -- */}
      {data?.volumeSpike.isSpike ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-orange-300 bg-orange-50 p-3 text-xs text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200">
          <Flame className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Coverage volume spike detected.</strong> {data.volumeSpike.recentCount} stories in
            the last 24 hours against a baseline of {data.volumeSpike.baselinePerWindow} —{' '}
            <strong>{data.volumeSpike.ratio}× normal</strong>. Check the emerging issues panel below.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------ Market context -- */}
      <MarketPanel />

      {/* -------------------------------------------------------- Charts -- */}
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="News volume trend"
            description={`Stories per day, ${rangeLabel}`}
            tooltip="Daily story counts bucketed in the display timezone. Gaps are shown as zero rather than being interpolated."
            action={
              <Link href="/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
                Analytics <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody>
            {loading ? <Skeleton className="h-[260px] w-full" /> : <VolumeTrendChart data={data?.volumeTrend ?? []} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sentiment mix"
            description={`Share of coverage, ${rangeLabel}`}
            tooltip="Distribution of the automated sentiment estimate across the selected period and company group."
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-[210px] w-full" />
            ) : (
              <SentimentDonut
                positive={totals?.positive ?? 0}
                neutral={totals?.neutral ?? 0}
                negative={totals?.negative ?? 0}
              />
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Sentiment trend"
            description="Positive, neutral and negative stories per day"
            tooltip="Tracks whether coverage is turning more negative over time — useful as an early reputational signal."
          />
          <CardBody>
            {loading ? <Skeleton className="h-[260px] w-full" /> : <SentimentTrendChart data={data?.volumeTrend ?? []} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Company-wise share of coverage"
            description="Stacked daily volume by company group"
            tooltip="Each story is attributed to the company group of its highest-confidence entity match. Stories about competitors and the wider industry are grouped under Market."
          />
          <CardBody>
            {loading ? <Skeleton className="h-[260px] w-full" /> : <CompanyTrendChart data={data?.volumeTrend ?? []} />}
          </CardBody>
        </Card>
      </section>

      {/* --------------------------------------------------- Comparison -- */}
      <Card>
        <CardHeader
          title="Company comparison"
          description="Sentiment and risk across the three Ola company groups"
          tooltip="Side-by-side comparison of positive, negative and high/critical-risk story counts for each tracked group in the selected period."
        />
        <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {loading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <ComparisonChart
              data={(data?.byGroup ?? [])
                .filter((g) => g.group !== 'market')
                .map((g) => ({
                  label: COMPANY_GROUP_SHORT[g.group as CompanyGroup],
                  positive: g.positive,
                  negative: g.negative,
                  highRisk: g.highRisk,
                }))}
            />
          )}
          <div className="space-y-2.5">
            {(data?.byGroup ?? []).map((entry) => (
              <div key={entry.group} className="rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">
                    {COMPANY_GROUP_LABELS[entry.group as CompanyGroup]}
                  </span>
                  <Badge tone={entry.avgSentiment < -0.05 ? 'negative' : entry.avgSentiment > 0.05 ? 'positive' : 'neutral'}>
                    avg {entry.avgSentiment.toFixed(2)}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                  <Stat label="Stories" value={entry.total} />
                  <Stat label="24h" value={entry.last24h} />
                  <Stat label="Positive" value={entry.positive} tone="text-[var(--color-positive)]" />
                  <Stat label="High risk" value={entry.highRisk} tone="text-[var(--color-riskHigh)]" />
                </dl>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ------------------------------------------------------ Top lists -- */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Top publishers"
            description="Most frequent sources of coverage"
            tooltip="Publisher names come from the feed itself. High-volume publishers are not necessarily the most credible ones — credibility is configured per source."
          />
          <CardBody>
            <TopList
              loading={loading}
              items={(data?.topPublishers ?? []).map((p) => ({ label: p.publisher, value: p.count }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Trending topics"
            description="Most repeated phrases in headlines"
            tooltip="Frequent unigrams and bigrams extracted from headlines and syndicated descriptions in this period."
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.trendingTopics ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-subtle">No topics yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data!.trendingTopics.map((topic) => (
                  <Link
                    key={topic.topic}
                    href={`/feed?q=${encodeURIComponent(topic.topic)}`}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {topic.topic}
                    <span className="ml-1 tabular-nums text-subtle">{topic.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Emerging issues"
            description="Topics rising against their own baseline"
            tooltip="A topic is emerging when its share of the last 72 hours is at least 1.5× its share of the preceding period, or when it is entirely new with enough volume."
            action={<Flame className="h-4 w-4 text-[var(--color-riskHigh)]" aria-hidden="true" />}
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.emergingIssues ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-subtle">
                Nothing is rising unusually fast right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {data!.emergingIssues.map((issue) => (
                  <li key={issue.topic} className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[var(--color-riskHigh)]" aria-hidden="true" />
                    <Link
                      href={`/feed?q=${encodeURIComponent(issue.topic)}`}
                      className="min-w-0 flex-1 truncate text-xs font-medium hover:underline"
                    >
                      {issue.topic}
                    </Link>
                    {issue.isNew ? <Badge tone="warning">new</Badge> : null}
                    <span className="shrink-0 text-[11px] tabular-nums text-subtle">
                      {issue.lift.toFixed(1)}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Most-mentioned executives"
            description="People named in this period's coverage"
            tooltip="Counted from configured executives only. Add or remove people in Settings → Companies."
          />
          <CardBody>
            <TopList
              loading={loading}
              emptyMessage="No tracked executive was named in this period."
              items={(data?.topExecutives ?? []).map((e) => ({ label: e.name, value: e.count }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Most-mentioned products"
            description="Products and models in the news"
            tooltip="Counted from configured products only. Add or remove products in Settings → Companies."
          />
          <CardBody>
            <TopList
              loading={loading}
              emptyMessage="No tracked product was named in this period."
              items={(data?.topProducts ?? []).map((p) => ({ label: p.name, value: p.count }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Geographic distribution"
            description="Where coverage originates"
            tooltip="Country is taken from the source feed's own metadata where available, otherwise from the source's configured country."
            action={<Globe2 className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />}
          />
          <CardBody>
            <TopList
              loading={loading}
              items={(data?.geography ?? []).map((g) => ({
                label: COUNTRY_NAMES[g.country] ?? g.country,
                value: g.count,
              }))}
            />
          </CardBody>
        </Card>
      </section>

      {/* -------------------------------------------------- Categories --- */}
      <Card>
        <CardHeader
          title="Coverage by category"
          description={`Story counts per category, ${rangeLabel}`}
          tooltip="Categories are assigned by a weighted keyword classifier. Headline matches count double. Edit categories and their keywords in Settings."
        />
        <CardBody>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (data?.categories ?? []).length === 0 ? (
            <p className="py-8 text-center text-xs text-subtle">No categorised stories yet.</p>
          ) : (
            <CategoryChart data={(data?.categories ?? []).slice(0, 12).map((c) => ({ label: c.label, count: c.count }))} />
          )}
        </CardBody>
      </Card>

      {/* ----------------------------------------------- Source health --- */}
      <Card>
        <CardHeader
          title="Source health"
          description="What is actually running right now"
          tooltip="Live sources are contacted on every refresh. Sources awaiting credentials or blocked by the publisher are skipped and never produce fabricated results."
          action={
            <Link href="/sources" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
              Manage sources <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          }
        />
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <HealthStat label="Live" value={data?.sourceHealth.live ?? 0} tone="text-[var(--color-positive)]" loading={loading} />
            <HealthStat label="Demo data" value={data?.sourceHealth.demo ?? 0} tone="text-amber-600" loading={loading} />
            <HealthStat label="Awaiting credentials" value={data?.sourceHealth.awaitingCredentials ?? 0} loading={loading} />
            <HealthStat label="Disabled" value={data?.sourceHealth.disabled ?? 0} loading={loading} />
            <HealthStat label="Failing" value={data?.sourceHealth.failing ?? 0} tone="text-[var(--color-negative)]" loading={loading} />
          </dl>
          {data?.lastRefreshAt ? (
            <p className="mt-3 text-[11px] text-subtle">
              Last successful refresh: {formatDateTime(data.lastRefreshAt, settings.timezone)}{' '}
              {formatTimeZoneAbbr(settings.timezone)}
            </p>
          ) : (
            <p className="mt-3 text-[11px] text-subtle">No refresh has completed yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PageHeading({ rangeLabel, lastRefreshAt }: { rangeLabel: string; lastRefreshAt: string | null }) {
  const { settings } = useSettings();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Building2 className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Executive overview
        </h1>
        <p className="mt-0.5 text-xs text-subtle">
          ANI Technologies / Ola Cabs, Ola Electric and Krutrim — {rangeLabel}.{' '}
          <span className="inline-flex items-center gap-1">
            All derived scores are estimates
            <InfoTip label="Summaries, sentiment, risk, relevance and importance are produced by an automated pipeline from the headline and the publisher's syndicated description. Each carries a confidence value. They are decision support, not verified fact." />
          </span>
        </p>
      </div>
      {lastRefreshAt ? (
        <p className="text-[11px] text-subtle">
          Data as at {formatDateTime(lastRefreshAt, settings.timezone)}{' '}
          {formatTimeZoneAbbr(settings.timezone)}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className={`mt-0.5 font-semibold tabular-nums ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}

function HealthStat({
  label, value, tone, loading,
}: {
  label: string;
  value: number;
  tone?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
      <dt className="text-[11px] text-subtle">{label}</dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone ?? ''}`}>
        {loading ? <Skeleton className="h-6 w-8" /> : value}
      </dd>
    </div>
  );
}
