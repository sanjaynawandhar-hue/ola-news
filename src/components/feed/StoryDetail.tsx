'use client';

import { ExternalLink, ImageDown, Star, StarOff } from 'lucide-react';
import { Badge, Button, InfoTip, Modal, ProgressBar, Skeleton } from '@/components/ui';
import { DemoBadge, RiskBadge, SentimentBadge, VerificationBadge } from '@/components/ui/badges';
import { useApi } from '@/hooks/useApi';
import { useSettings } from '@/components/providers';
import { formatDateTime, formatTimeZoneAbbr, relativeTime } from '@/lib/time';
import { CONTENT_TYPE_LABEL } from './labels';
import { RISK_DIMENSIONS } from '@/lib/constants';
import { aggregatorOf } from '@/lib/utils';
import type { FeedArticle } from '@/types';

interface DetailResponse {
  article: FeedArticle;
  related: Array<{ id: string; title: string; publisher: string; publishedAt: string; url: string }>;
  entities: Array<{ type: string; value: string; mentions: number; confidence: number }>;
  riskDimensions: Record<string, number>;
}

/**
 * Full story view. The publisher's own headline and description are shown
 * separately from the machine-generated summary and analysis, so a reader can
 * always tell which text came from where.
 */
export function StoryDetail({
  article, open, onClose, onExportPng, onToggleImportant,
}: {
  article: FeedArticle | null;
  open: boolean;
  onClose: () => void;
  onExportPng: (article: FeedArticle) => void;
  onToggleImportant: (article: FeedArticle) => void;
}) {
  const { settings } = useSettings();
  const { data, loading, error } = useApi<DetailResponse>(
    article && open ? `/api/articles/${article.id}` : null,
    [article?.id, open],
  );

  if (!article) return null;
  const current = data?.article ?? article;
  const tz = formatTimeZoneAbbr(settings.timezone);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Story detail"
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => onToggleImportant(current)}
            className="mr-auto"
          >
            {current.important ? (
              <StarOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {current.important ? 'Remove from briefing' : 'Add to briefing'}
          </Button>
          <Button variant="secondary" onClick={() => onExportPng(current)}>
            <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
            Export PNG
          </Button>
          <a href={current.url} target="_blank" rel="noopener noreferrer nofollow">
            <Button variant="primary">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open original
            </Button>
          </a>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {current.isDemo ? <DemoBadge /> : null}
          {current.companyLabel ? <Badge tone="accent">{current.companyLabel}</Badge> : null}
          <Badge>{current.categoryLabel}</Badge>
          <SentimentBadge value={current.sentiment} score={current.sentimentScore} />
          <RiskBadge value={current.riskLevel} score={current.riskScore} />
          <VerificationBadge value={current.verification} corroboration={current.corroboration} />
          <Badge tone="info">{CONTENT_TYPE_LABEL[current.contentType]}</Badge>
        </div>

        <section>
          <SectionLabel
            label="Original headline"
            tip="Reproduced exactly as published. Headlines are the publisher's copyright."
          />
          <h2 className="text-lg font-semibold leading-snug tracking-tight">{current.title}</h2>
        </section>

        {current.description ? (
          <section>
            <SectionLabel
              label="Publisher description"
              tip="The short description the publisher syndicated in their feed. Not edited by this dashboard."
            />
            <p className="text-sm leading-relaxed text-muted">{current.description}</p>
          </section>
        ) : null}

        <section className="rounded-lg border border-[var(--border)] p-3">
          <SectionLabel
            label="AI summary · machine-generated"
            tip="Produced by the analysis pipeline from the headline and publisher description only. It never introduces facts absent from the source."
          />
          <p className="text-sm leading-relaxed">{current.aiSummary}</p>
          <p className="mt-2 text-[10.5px] text-subtle">Engine: {current.engine}</p>
        </section>

        <section className="rounded-lg bg-[var(--bg-inset)] p-3">
          <SectionLabel
            label="Why this matters · analyst view"
            tip="This dashboard's own interpretation for an executive reader. Interpretation, not reported fact."
          />
          <p className="text-sm leading-relaxed">{current.whyItMatters}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <SectionLabel label="Scores" tip="Every score is an automated estimate with its own confidence." />
            <dl className="space-y-2.5">
              <ScoreRow label="Relevance" value={current.relevance} suffix="%" />
              <ScoreRow label="Automatic importance" value={current.importanceScore} suffix="/100" />
              <ScoreRow label="Risk score" value={current.riskScore} suffix="/100" tone="warning" />
              <ScoreRow label="Analysis confidence" value={current.confidence} suffix="%" />
              <ScoreRow label="Sentiment confidence" value={current.sentimentConfidence} suffix="%" />
            </dl>
          </div>

          <div>
            <SectionLabel
              label="Risk dimensions"
              tip="Contribution of each business risk dimension, derived from the matched risk drivers."
            />
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <dl className="space-y-2.5">
                {RISK_DIMENSIONS.map((dimension) => (
                  <ScoreRow
                    key={dimension}
                    label={dimension.charAt(0).toUpperCase() + dimension.slice(1)}
                    value={Math.round(data?.riskDimensions?.[dimension] ?? current.riskDimensions?.[dimension] ?? 0)}
                    suffix="/100"
                    tone="warning"
                  />
                ))}
              </dl>
            )}
            {current.riskDrivers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {current.riskDrivers.map((driver) => (
                  <Badge key={driver} tone="warning">{driver}</Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-subtle">No risk drivers matched.</p>
            )}
          </div>
        </section>

        <section>
          <SectionLabel label="Provenance" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <Meta label="Publisher" value={current.publisher} />
            <Meta label="Source connector" value={current.sourceName} />
            <Meta label="Source credibility" value={`${current.sourceCredibility}/100`} />
            <Meta label="Published" value={`${formatDateTime(current.publishedAt, settings.timezone)} ${tz}`} />
            <Meta label="Fetched" value={`${formatDateTime(current.fetchedAt, settings.timezone)} ${tz}`} />
            <Meta label="Geography" value={current.country} />
            <Meta label="Language" value={current.language} />
            <Meta label="Corroborating publishers" value={String(current.corroboration)} />
            <Meta label="Related in cluster" value={String(current.relatedCount)} />
          </dl>
          <p className="mt-2 break-all text-[11px] text-subtle">
            Link:{' '}
            <a
              href={current.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[var(--accent)] hover:underline"
            >
              {aggregatorOf(current.canonicalUrl)
                ? `via ${aggregatorOf(current.canonicalUrl)} → ${current.publisher}`
                : current.canonicalUrl}
            </a>
            {aggregatorOf(current.canonicalUrl) ? (
              <span className="ml-1">
                (this aggregator redirects to the publisher in the browser; the raw link is an
                opaque redirect token, so the publisher name above is the attribution)
              </span>
            ) : null}
          </p>
        </section>

        {data?.entities?.length ? (
          <section>
            <SectionLabel
              label="Extracted entities"
              tip="Companies, people, products, regulators and locations matched against the tracked configuration, each with a match confidence."
            />
            <div className="flex flex-wrap gap-1.5">
              {data.entities.map((entity) => (
                <Badge
                  key={`${entity.type}-${entity.value}`}
                  tone={entity.type === 'REGULATOR' ? 'warning' : entity.type === 'COMPANY' ? 'accent' : 'neutral'}
                  title={`${entity.type.toLowerCase()} · ${entity.mentions} mention(s) · ${entity.confidence}% confidence`}
                >
                  {entity.value}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionLabel
            label="Related coverage"
            tip="Other articles clustered to the same underlying story. Independent publishers here are what drive the corroboration status."
          />
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : error ? (
            <p className="text-xs text-[var(--color-negative)]">{error}</p>
          ) : (data?.related ?? []).length === 0 ? (
            <p className="text-xs text-subtle">No other article has been clustered with this story.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {data!.related.map((item) => (
                <li key={item.id} className="p-2.5">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-xs font-medium hover:text-[var(--accent)]"
                  >
                    {item.title}
                  </a>
                  <p className="mt-0.5 text-[11px] text-subtle">
                    {item.publisher} · {relativeTime(item.publishedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

function SectionLabel({ label, tip }: { label: string; tip?: string }) {
  return (
    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">
      {label}
      {tip ? <InfoTip label={tip} /> : null}
    </p>
  );
}

function ScoreRow({
  label, value, suffix, tone = 'accent',
}: {
  label: string;
  value: number;
  suffix: string;
  tone?: 'accent' | 'warning';
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <dt className="text-muted">{label}</dt>
        <dd className="font-semibold tabular-nums">
          {value}
          {suffix}
        </dd>
      </div>
      <ProgressBar value={value} tone={tone} className="mt-1" />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="truncate font-medium" title={value}>{value}</dd>
    </div>
  );
}
