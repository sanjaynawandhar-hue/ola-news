'use client';

import * as React from 'react';
import {
  Bookmark, BookmarkCheck, Copy, ExternalLink, ImageDown, Layers, Star, StarOff,
} from 'lucide-react';
import { Badge, Button, Checkbox, InfoTip } from '@/components/ui';
import { ConfidenceMeter, DemoBadge, RiskBadge, SentimentBadge, VerificationBadge } from '@/components/ui/badges';
import { useSettings, useToast } from '@/components/providers';
import { formatDateTime, formatTimeZoneAbbr, relativeTime } from '@/lib/time';
import { CONTENT_TYPE_LABEL } from './labels';
import { cn } from '@/lib/utils';
import type { FeedArticle } from '@/types';

export interface ArticleActions {
  onToggleBookmark: (article: FeedArticle) => void;
  onToggleImportant: (article: FeedArticle) => void;
  onExportPng: (article: FeedArticle) => void;
  onOpenDetail: (article: FeedArticle) => void;
  onSelect?: (id: string, selected: boolean) => void;
  /** Ids currently selected for bulk actions. */
  selectedIds?: Set<string>;
  selectable?: boolean;
}

export function ArticleCard({ article, actions }: { article: FeedArticle; actions: ArticleActions }) {
  const { settings } = useSettings();
  const { push } = useToast();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(article.canonicalUrl || article.url);
      push({ tone: 'success', title: 'Link copied', description: article.publisher });
    } catch {
      push({ tone: 'error', title: 'Could not copy the link', description: 'Clipboard access was denied.' });
    }
  };

  const riskAccent =
    article.riskLevel === 'CRITICAL'
      ? 'before:bg-[var(--color-riskCritical)]'
      : article.riskLevel === 'HIGH'
        ? 'before:bg-[var(--color-riskHigh)]'
        : article.riskLevel === 'MEDIUM'
          ? 'before:bg-[var(--color-riskMedium)]'
          : 'before:bg-transparent';

  return (
    <article
      className={cn(
        'surface relative overflow-hidden rounded-xl p-4 transition-shadow hover:shadow-md',
        'before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[""]',
        riskAccent,
      )}
    >
      <div className="flex items-start gap-3">
        {actions.selectable ? (
          <Checkbox
            label={<span className="sr-only">Select “{article.title}”</span>}
            checked={actions.selectedIds?.has(article.id) ?? false}
            onChange={(event) => actions.onSelect?.(article.id, event.target.checked)}
            className="mt-1 shrink-0"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          {/* --- Metadata row ------------------------------------------- */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {article.isDemo ? <DemoBadge /> : null}
            {article.companyLabel ? <Badge tone="accent">{article.companyLabel}</Badge> : null}
            <Badge>{article.categoryLabel}</Badge>
            <SentimentBadge value={article.sentiment} score={article.sentimentScore} />
            <RiskBadge value={article.riskLevel} score={article.riskScore} />
            <VerificationBadge value={article.verification} corroboration={article.corroboration} />
            {article.contentType !== 'REPORTING' ? (
              <Badge tone="info">{CONTENT_TYPE_LABEL[article.contentType]}</Badge>
            ) : null}
            {article.relatedCount > 0 ? (
              <Badge tone="neutral" title={`${article.relatedCount} related article(s) in this story cluster`}>
                <Layers className="h-3 w-3" aria-hidden="true" />
                {article.relatedCount} related
              </Badge>
            ) : null}
          </div>

          {/* --- Original headline, verbatim ----------------------------- */}
          <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
            <button
              onClick={() => actions.onOpenDetail(article)}
              className="text-left hover:text-[var(--accent)]"
            >
              {article.title}
            </button>
          </h3>

          {/* --- Machine-generated summary ------------------------------- */}
          <div className="mt-2">
            <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
              AI summary
              <InfoTip label="Machine-generated from the headline and the publisher's syndicated description. It never adds facts that are not in the source." />
            </p>
            <p className="text-[13px] leading-relaxed text-muted">{article.aiSummary}</p>
          </div>

          {article.whyItMatters ? (
            <div className="mt-2 rounded-lg bg-[var(--bg-inset)] p-2.5">
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ola-700)] dark:text-[var(--color-ola-300)]">
                Why this matters
                <InfoTip label="Analytical framing produced by this dashboard. It is interpretation, not reported fact." />
              </p>
              <p className="text-[13px] leading-relaxed text-muted">{article.whyItMatters}</p>
            </div>
          ) : null}

          {/* --- Provenance --------------------------------------------- */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-subtle">
            <span className="font-medium text-[var(--fg-muted)]">{article.publisher}</span>
            <span aria-hidden="true">·</span>
            <span title={`Published ${formatDateTime(article.publishedAt, settings.timezone)} ${formatTimeZoneAbbr(settings.timezone)}`}>
              {relativeTime(article.publishedAt)}
            </span>
            <span aria-hidden="true">·</span>
            <span title={`Collected ${formatDateTime(article.fetchedAt, settings.timezone)} ${formatTimeZoneAbbr(settings.timezone)}`}>
              fetched {relativeTime(article.fetchedAt)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="uppercase">{article.country}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase">{article.language}</span>
            <span aria-hidden="true">·</span>
            <span>relevance {article.relevance}%</span>
            <span aria-hidden="true">·</span>
            <span title="Automatic importance score used to rank stories for briefings">
              importance {article.importanceScore}
            </span>
            <ConfidenceMeter value={article.confidence} />
          </div>

          {/* --- Actions ------------------------------------------------- */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <a href={article.url} target="_blank" rel="noopener noreferrer nofollow">
              <Button size="sm" variant="outline">
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Original
              </Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => void copyLink()}>
              <Copy className="h-3 w-3" aria-hidden="true" />
              Copy link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.onToggleImportant(article)}
              aria-pressed={article.important}
              title={article.important ? 'Remove from the briefing shortlist' : 'Add to the briefing shortlist'}
            >
              {article.important ? (
                <StarOff className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Star className="h-3 w-3" aria-hidden="true" />
              )}
              {article.important ? 'In briefing' : 'Add to briefing'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => actions.onExportPng(article)}>
              <ImageDown className="h-3 w-3" aria-hidden="true" />
              Export PNG
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => actions.onToggleBookmark(article)}
              aria-pressed={article.bookmarked}
              title={article.bookmarked ? 'Remove bookmark' : 'Bookmark this story'}
              className="ml-auto"
            >
              {article.bookmarked ? (
                <BookmarkCheck className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="sr-only">{article.bookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
