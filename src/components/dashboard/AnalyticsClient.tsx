'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { Card, CardBody, CardHeader, ErrorState, Skeleton, Tabs, InfoTip } from '@/components/ui';
import {
  CategoryChart, CompanyTrendChart, ComparisonChart, SentimentDonut, SentimentTrendChart, VolumeTrendChart,
} from '@/components/charts';
import { TopList } from './TopList';
import { KpiCard } from './KpiCard';
import { useApi } from '@/hooks/useApi';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { COMPANY_GROUP_SHORT, type CompanyGroup } from '@/lib/constants';
import type { OverviewMetrics } from '@/lib/queries';

const GROUP_TABS = [
  { value: 'all', label: 'All Ola companies' },
  { value: 'ani', label: COMPANY_GROUP_SHORT.ani },
  { value: 'olaelectric', label: COMPANY_GROUP_SHORT.olaelectric },
  { value: 'krutrim', label: COMPANY_GROUP_SHORT.krutrim },
  { value: 'market', label: COMPANY_GROUP_SHORT.market },
];

export function AnalyticsClient() {
  const searchParams = useSearchParams();
  const { dataVersion } = useRefresh();
  const [group, setGroup] = React.useState('all');
  const days = Number(searchParams.get('range') ?? '30') || 30;

  const { data, loading, error, reload } = useApi<OverviewMetrics>(
    `/api/overview?days=${days}${group === 'all' ? '' : `&groups=${group}`}`,
    [dataVersion, group, days],
  );

  const totals = data?.totals;
  const netSentiment =
    totals && totals.positive + totals.negative > 0
      ? ((totals.positive - totals.negative) / (totals.positive + totals.negative)).toFixed(2)
      : '0.00';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <BarChart3 className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Analytics
        </h1>
        <p className="mt-0.5 text-xs text-subtle">
          News volume, sentiment, category mix and company comparison over the selected range. Change
          the range from the header.
        </p>
      </div>

      <Tabs
        tabs={GROUP_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
        value={group}
        onChange={setGroup}
        className="max-w-3xl"
      />

      {error ? <ErrorState title="Could not load analytics" message={error} onRetry={reload} /> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Stories in range" value={totals?.last30d ?? 0} loading={loading}
          tooltip="Total stories published within the selected range for this group." />
        <KpiCard label="Net sentiment" value={netSentiment} loading={loading}
          tone={Number(netSentiment) < 0 ? 'negative' : 'positive'}
          sublabel="(positive − negative) / total"
          tooltip="A simple net polarity index over the range. −1 is entirely negative coverage, +1 entirely positive." />
        <KpiCard label="High / critical risk" value={totals?.highRisk ?? 0} loading={loading} tone="warning"
          tooltip="Stories whose automated risk estimate reached HIGH or CRITICAL." />
        <KpiCard label="Coverage spike" value={`${data?.volumeSpike.ratio ?? 1}×`} loading={loading}
          tone={data?.volumeSpike.isSpike ? 'negative' : 'default'}
          sublabel={`baseline ${data?.volumeSpike.baselinePerWindow ?? 0}/day`}
          tooltip="Ratio of the last 24 hours of coverage to the mean of the preceding seven 24-hour windows." />
        <KpiCard label="Emerging topics" value={data?.emergingIssues.length ?? 0} loading={loading}
          tooltip="Topics whose share of recent coverage is rising at least 1.5× against the prior period, or that are entirely new." />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="News volume trend" description="Stories per day"
            tooltip="Daily counts bucketed in the display timezone." />
          <CardBody>
            {loading ? <Skeleton className="h-[300px] w-full" /> : <VolumeTrendChart data={data?.volumeTrend ?? []} height={300} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Sentiment mix" description="Share of coverage"
            tooltip="Distribution of the automated sentiment estimate." />
          <CardBody>
            {loading ? <Skeleton className="h-[240px] w-full" /> : (
              <SentimentDonut
                positive={totals?.positive ?? 0}
                neutral={totals?.neutral ?? 0}
                negative={totals?.negative ?? 0}
                height={240}
              />
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Sentiment trend" description="Positive, neutral and negative per day"
            tooltip="Watch for a sustained rise in the negative line — that is the earliest reputational signal this dashboard produces." />
          <CardBody>
            {loading ? <Skeleton className="h-[280px] w-full" /> : <SentimentTrendChart data={data?.volumeTrend ?? []} height={280} />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Company-wise share of coverage" description="Stacked daily volume"
            tooltip="Each story is attributed to the company group of its highest-confidence entity match." />
          <CardBody>
            {loading ? <Skeleton className="h-[280px] w-full" /> : <CompanyTrendChart data={data?.volumeTrend ?? []} height={280} />}
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader title="Company comparison" description="Sentiment and risk across the three Ola groups"
          tooltip="Counts of positive, negative and high/critical-risk stories for each tracked group." />
        <CardBody>
          {loading ? <Skeleton className="h-[300px] w-full" /> : (
            <ComparisonChart
              height={300}
              data={(data?.byGroup ?? []).map((g) => ({
                label: COMPANY_GROUP_SHORT[g.group as CompanyGroup],
                positive: g.positive,
                negative: g.negative,
                highRisk: g.highRisk,
              }))}
            />
          )}
        </CardBody>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Coverage by category" description="Story counts per category"
            tooltip="Assigned by a weighted keyword classifier; headline matches count double. Configure in Settings." />
          <CardBody>
            {loading ? <Skeleton className="h-[340px] w-full" /> : (
              <CategoryChart data={(data?.categories ?? []).slice(0, 14).map((c) => ({ label: c.label, count: c.count }))} height={340} />
            )}
          </CardBody>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Top publishers"
              tooltip="Volume only. Configure per-source credibility on the Sources page." />
            <CardBody>
              <TopList loading={loading} items={(data?.topPublishers ?? []).map((p) => ({ label: p.publisher, value: p.count }))} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Emerging issues"
              tooltip="Topics rising against their own recent baseline." />
            <CardBody>
              <TopList
                loading={loading}
                emptyMessage="Nothing is rising unusually fast right now."
                items={(data?.emergingIssues ?? []).map((e) => ({
                  label: `${e.topic}${e.isNew ? ' (new)' : ''}`,
                  value: e.recentCount,
                }))}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      <p className="flex items-start gap-1.5 text-[11px] text-subtle">
        <InfoTip label="Every metric on this page is derived from automated analysis of headlines and publisher-supplied descriptions. Treat them as directional indicators, not measurements." />
        All analytics are computed from automated estimates and should be read as directional
        indicators rather than measurements.
      </p>
    </div>
  );
}
