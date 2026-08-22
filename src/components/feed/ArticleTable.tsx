'use client';

import { ExternalLink, ImageDown, Star, StarOff } from 'lucide-react';
import { Badge, Button, Checkbox } from '@/components/ui';
import { DemoBadge, RiskBadge, SentimentBadge, VerificationBadge } from '@/components/ui/badges';
import { useSettings } from '@/components/providers';
import { formatDateTime, formatTimeZoneAbbr } from '@/lib/time';
import type { ArticleActions } from './ArticleCard';
import type { FeedArticle } from '@/types';

/** Dense table view. Scrolls horizontally on narrow screens rather than wrapping. */
export function ArticleTable({
  articles, actions,
}: {
  articles: FeedArticle[];
  actions: ArticleActions;
}) {
  const { settings } = useSettings();
  const tz = formatTimeZoneAbbr(settings.timezone);

  return (
    <div className="surface scroll-thin overflow-x-auto rounded-xl">
      <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
        <caption className="sr-only">
          Collected stories with company, category, sentiment, risk and provenance
        </caption>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
            {actions.selectable ? <Th className="w-9" /> : null}
            <Th className="min-w-[22rem]">Headline</Th>
            <Th>Company</Th>
            <Th>Category</Th>
            <Th>Sentiment</Th>
            <Th>Risk</Th>
            <Th>Verification</Th>
            <Th className="text-right">Rel.</Th>
            <Th className="text-right">Imp.</Th>
            <Th>Publisher</Th>
            <Th>Published ({tz})</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr
              key={article.id}
              className="border-b border-[var(--border)] align-top last:border-0 hover:bg-[var(--bg-subtle)]/60"
            >
              {actions.selectable ? (
                <Td>
                  <Checkbox
                    label={<span className="sr-only">Select “{article.title}”</span>}
                    checked={actions.selectedIds?.has(article.id) ?? false}
                    onChange={(event) => actions.onSelect?.(article.id, event.target.checked)}
                  />
                </Td>
              ) : null}
              <Td>
                <button
                  onClick={() => actions.onOpenDetail(article)}
                  className="text-left font-medium leading-snug hover:text-[var(--accent)]"
                >
                  {article.title}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {article.isDemo ? <DemoBadge /> : null}
                  {article.relatedCount > 0 ? (
                    <Badge tone="neutral">{article.relatedCount} related</Badge>
                  ) : null}
                </div>
              </Td>
              <Td className="whitespace-nowrap">{article.companyLabel ?? '—'}</Td>
              <Td className="whitespace-nowrap">{article.categoryLabel}</Td>
              <Td><SentimentBadge value={article.sentiment} score={article.sentimentScore} /></Td>
              <Td><RiskBadge value={article.riskLevel} score={article.riskScore} /></Td>
              <Td><VerificationBadge value={article.verification} corroboration={article.corroboration} /></Td>
              <Td className="text-right tabular-nums">{article.relevance}</Td>
              <Td className="text-right tabular-nums">{article.importanceScore}</Td>
              <Td className="whitespace-nowrap">{article.publisher}</Td>
              <Td className="whitespace-nowrap text-subtle">
                {formatDateTime(article.publishedAt, settings.timezone)}
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => actions.onToggleImportant(article)}
                    title={article.important ? 'Remove from briefing' : 'Add to briefing'}
                  >
                    {article.important ? (
                      <StarOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                      {article.important ? 'Remove from briefing' : 'Add to briefing'}
                    </span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => actions.onExportPng(article)}
                    title="Export PNG card"
                  >
                    <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Export PNG</span>
                  </Button>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title="Open the original article"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Open original</span>
                  </a>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-subtle ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-2.5 ${className}`}>{children}</td>;
}
