'use client';

import * as React from 'react';
import {
  ArrowDown, ArrowUp, Download, FileDown, ImageDown, Presentation, Sparkles, X,
} from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, ErrorState, Input, InfoTip,
  Select, Skeleton, Toggle,
} from '@/components/ui';
import { DemoBadge, RiskBadge, SentimentBadge } from '@/components/ui/badges';
import { ExportPngDialog } from '@/components/feed/ExportPngDialog';
import { useApi, mutate } from '@/hooks/useApi';
import { useSettings, useToast } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { formatDate, formatDateTime, formatTimeZoneAbbr } from '@/lib/time';
import { BRIEFING_TYPES } from '@/lib/constants';
import { PPTX_THEMES } from '@/lib/export/theme';
import type { FeedArticle, Paged, RegulatoryItem } from '@/types';

type ShortlistArticle = FeedArticle & { note: string | null; manual: boolean };

export function BriefingClient() {
  const { settings } = useSettings();
  const { push } = useToast();
  const { dataVersion } = useRefresh();

  const { data, loading, error, reload } = useApi<{ items: ShortlistArticle[]; total: number }>(
    '/api/important',
    [dataVersion],
  );
  const { data: regulatory } = useApi<Paged<RegulatoryItem>>(
    '/api/regulatory?pageSize=25&page=1',
    [dataVersion],
  );
  const { data: history, reload: reloadHistory } = useApi<{
    briefings: Array<{ id: string; title: string; type: string; slideCount: number; createdAt: string }>;
    exports: Array<{ id: string; kind: string; filename: string; sizeBytes: number; createdAt: string }>;
  }>('/api/briefings', [dataVersion]);

  const [order, setOrder] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState('Ola News — Daily Executive Briefing');
  const [subtitle, setSubtitle] = React.useState('ANI Technologies / Ola Cabs · Ola Electric · Krutrim');
  const [type, setType] = React.useState('DAILY');
  const [theme, setTheme] = React.useState('ola-light');
  const [includeSummary, setIncludeSummary] = React.useState(true);
  const [includeTrend, setIncludeTrend] = React.useState(true);
  const [includeComparison, setIncludeComparison] = React.useState(true);
  const [autoSelectTop, setAutoSelectTop] = React.useState(0);
  const [regulatoryIds, setRegulatoryIds] = React.useState<string[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [exportArticle, setExportArticle] = React.useState<FeedArticle | null>(null);

  // Keep local ordering in sync with the server shortlist. Folded in during
  // render, keyed on the response, so re-ordering never costs an extra pass.
  const [lastShortlist, setLastShortlist] = React.useState<typeof data>(null);
  if (data && data !== lastShortlist) {
    setLastShortlist(data);
    setOrder(data.items.map((item) => item.id));
  }

  const byId = React.useMemo(
    () => new Map((data?.items ?? []).map((item) => [item.id, item])),
    [data],
  );
  const ordered = order.map((id) => byId.get(id)).filter((a): a is ShortlistArticle => !!a);

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    void mutate('/api/important/reorder', { method: 'PUT', body: { articleIds: next } }).catch(() => {
      push({ tone: 'error', title: 'Could not save the new order' });
    });
  };

  const removeStory = async (article: ShortlistArticle) => {
    setOrder((current) => current.filter((id) => id !== article.id));
    try {
      await mutate(`/api/important?articleId=${article.id}`, { method: 'DELETE' });
      reload();
    } catch {
      push({ tone: 'error', title: 'Could not remove this story' });
      reload();
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/export/pptx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          subtitle,
          type,
          theme,
          template: 'standard',
          articleIds: ordered.map((a) => a.id),
          regulatoryIds,
          includeExecutiveSummary: includeSummary,
          includeTrendSlide: includeTrend,
          includeComparisonSlide: includeComparison,
          ...(autoSelectTop > 0 ? { autoSelectTop } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? 'The briefing could not be generated.');
      }

      const slideCount = response.headers.get('x-slide-count');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ??
        'ola-news-briefing.pptx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      reloadHistory();
      push({
        tone: 'success',
        title: 'Briefing generated',
        description: `${slideCount ?? '—'} slides · ${link.download}`,
      });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Briefing generation failed',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };

  const estimatedSlides =
    1 + // cover
    (includeSummary ? 1 : 0) +
    (includeTrend ? 1 : 0) +
    (includeComparison ? 1 : 0) +
    ordered.length +
    regulatoryIds.length +
    autoSelectTop +
    1; // closing

  const tz = formatTimeZoneAbbr(settings.timezone);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Presentation className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Briefings &amp; exports
        </h1>
        <p className="mt-0.5 max-w-3xl text-xs text-subtle">
          Build a real, editable <code className="font-mono">.pptx</code> from your shortlist. Slides use
          native PowerPoint text, shapes, tables and charts — no screenshots — and every source link
          stays clickable.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ------------------------------------------------ Shortlist -- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Briefing shortlist"
              description="Reorder, remove, or add more stories from the feed"
              tooltip="Stories added with “Add to briefing” from the feed. The order here is the slide order in the exported deck."
              action={<Badge tone="accent">{ordered.length} stor{ordered.length === 1 ? 'y' : 'ies'}</Badge>}
            />
            <CardBody>
              {error ? <ErrorState title="Could not load the shortlist" message={error} onRetry={reload} /> : null}

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full" />
                  ))}
                </div>
              ) : ordered.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-6 w-6" aria-hidden="true" />}
                  title="Nothing shortlisted yet"
                  description="Open the live news feed and use “Add to briefing” on the stories you want. Or use automatic selection on the right to let the importance score choose for you."
                />
              ) : (
                <ol className="space-y-2">
                  {ordered.map((article, index) => (
                    <li
                      key={article.id}
                      className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bg-inset)] text-[11px] font-semibold tabular-nums">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium leading-snug">{article.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {article.isDemo ? <DemoBadge /> : null}
                          {article.companyLabel ? <Badge tone="accent">{article.companyLabel}</Badge> : null}
                          <Badge>{article.categoryLabel}</Badge>
                          <SentimentBadge value={article.sentiment} />
                          <RiskBadge value={article.riskLevel} />
                          <span className="text-[11px] text-subtle">
                            importance {article.importanceScore}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-subtle">
                          {article.publisher} · {formatDate(article.publishedAt, settings.timezone)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => move(index, -1)} disabled={index === 0}
                          aria-label={`Move “${article.title}” up`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => move(index, 1)} disabled={index === ordered.length - 1}
                          aria-label={`Move “${article.title}” down`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => setExportArticle(article)}
                          aria-label={`Export “${article.title}” as PNG`}
                          title="Export this slide's story as a PNG card"
                        >
                          <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => void removeStory(article)}
                          aria-label={`Remove “${article.title}” from the briefing`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Regulatory items to include"
              description="Each selected item becomes a dedicated regulatory slide"
              tooltip="Regulatory slides show the issuing authority, document type, severity, dates, response deadline and a QR code to the official document."
            />
            <CardBody>
              {(regulatory?.items ?? []).length === 0 ? (
                <p className="text-xs text-subtle">No regulatory items available.</p>
              ) : (
                <div className="scroll-thin max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {regulatory!.items.map((item) => (
                    <Checkbox
                      key={item.id}
                      checked={regulatoryIds.includes(item.id)}
                      onChange={() =>
                        setRegulatoryIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                      label={
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Badge tone="accent">{item.authority}</Badge>
                          <span className="truncate text-xs">{item.title}</span>
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {history?.exports?.length ? (
            <Card>
              <CardHeader
                title="Export history"
                description="Every PNG card and PPTX deck generated from this dashboard"
              />
              <CardBody>
                <ul className="divide-y divide-[var(--border)]">
                  {history.exports.slice(0, 12).map((record) => (
                    <li key={record.id} className="flex items-center gap-3 py-2 text-xs">
                      {record.kind === 'PPTX' ? (
                        <FileDown className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                      ) : (
                        <ImageDown className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{record.filename}</span>
                      <span className="shrink-0 tabular-nums text-subtle">
                        {(record.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                      <span className="shrink-0 text-subtle">
                        {formatDateTime(record.createdAt, settings.timezone)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ---------------------------------------------- Deck options -- */}
        <div className="space-y-4">
          <Card className="xl:sticky xl:top-20">
            <CardHeader title="Deck settings" description="Applied to the generated .pptx" />
            <CardBody className="space-y-3.5">
              <label className="block text-xs font-medium">
                Title
                <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1" />
              </label>

              <label className="block text-xs font-medium">
                Subtitle
                <Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} className="mt-1" />
              </label>

              <label className="block text-xs font-medium">
                Briefing type
                <Select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="mt-1 w-full"
                >
                  {BRIEFING_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </label>

              <label className="block text-xs font-medium">
                Theme
                <Select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="mt-1 w-full"
                >
                  {Object.values(PPTX_THEMES).map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </Select>
              </label>

              <label className="block text-xs font-medium">
                <span className="flex items-center gap-1">
                  Auto-select top stories
                  <InfoTip label="Adds the highest automatic-importance stories from the last day (or last week for a weekly briefing) on top of your shortlist. Set to 0 to use only your manual selection." />
                </span>
                <Input
                  type="number" min={0} max={30}
                  value={autoSelectTop}
                  onChange={(event) => setAutoSelectTop(Number(event.target.value))}
                  className="mt-1"
                />
              </label>

              <div className="space-y-2.5 rounded-lg border border-[var(--border)] p-3">
                <Toggle
                  label="Executive summary slide"
                  description="KPI tiles plus a leading-stories table"
                  checked={includeSummary}
                  onChange={setIncludeSummary}
                />
                <Toggle
                  label="Trend chart slide"
                  description="Native, editable PowerPoint line chart"
                  checked={includeTrend}
                  onChange={setIncludeTrend}
                />
                <Toggle
                  label="Company comparison slide"
                  description="Native clustered bar chart plus a summary table"
                  checked={includeComparison}
                  onChange={setIncludeComparison}
                />
              </div>

              <div className="rounded-lg bg-[var(--bg-subtle)] p-3 text-[11px] text-muted">
                <p className="font-medium">Estimated deck: ~{estimatedSlides} slides</p>
                <p className="mt-1">
                  Cover · {includeSummary ? 'summary · ' : ''}
                  {includeTrend ? 'trend · ' : ''}
                  {includeComparison ? 'comparison · ' : ''}
                  {ordered.length + autoSelectTop} story slide(s)
                  {regulatoryIds.length ? ` · ${regulatoryIds.length} regulatory` : ''} · sources
                </p>
                {settings.showPersonalBranding && settings.personalName ? (
                  <p className="mt-1.5">
                    Footer will read “Prepared for {settings.personalName}”.
                  </p>
                ) : (
                  <p className="mt-1.5">Personal branding is hidden in Settings.</p>
                )}
                <p className="mt-1.5">All dates rendered in {tz}.</p>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center"
                onClick={() => void generate()}
                loading={generating}
                disabled={ordered.length === 0 && regulatoryIds.length === 0 && autoSelectTop === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {generating ? 'Building deck…' : 'Download PPTX'}
              </Button>

              {ordered.length === 0 && regulatoryIds.length === 0 && autoSelectTop === 0 ? (
                <p className="text-[11px] text-subtle">
                  Add at least one story, regulatory item, or set auto-select above zero.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <ExportPngDialog
        article={exportArticle}
        open={!!exportArticle}
        onClose={() => setExportArticle(null)}
      />
    </div>
  );
}
