'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LayoutGrid, ListFilter, Loader2, Newspaper, Rows3, Save, Star, Trash2,
} from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Badge } from '@/components/ui';
import { ArticleCard, type ArticleActions } from './ArticleCard';
import { ArticleTable } from './ArticleTable';
import { FilterPanel, type FilterOptions } from './FilterPanel';
import { ExportPngDialog } from './ExportPngDialog';
import { StoryDetail } from './StoryDetail';
import { SORT_OPTIONS } from './labels';
import { useApi, mutate } from '@/hooks/useApi';
import { useToast } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import type { FeedArticle, FeedQuery, Paged } from '@/types';

const PAGE_SIZE = 20;

/**
 * Reads the full filter state out of the URL.
 *
 * The overview's KPI tiles and company tabs link straight into this page with
 * filters attached ("show me those 35 stories"), so every filter the panel can
 * set must round-trip through the address bar — not just the search term.
 */
function queryFromUrl(params: URLSearchParams): FeedQuery {
  const list = (key: string): string[] | undefined => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const values = raw.split(',').map((v) => v.trim()).filter(Boolean);
    return values.length ? values : undefined;
  };

  const sort = params.get('sort');
  const validSort: FeedQuery['sort'][] = ['recent', 'relevance', 'importance', 'risk', 'sentiment'];

  return {
    q: params.get('q') ?? undefined,
    groups: list('groups'),
    companies: list('companies'),
    brands: list('brands'),
    sources: list('sources'),
    sourceTypes: list('sourceTypes'),
    countries: list('countries'),
    languages: list('languages'),
    categories: list('categories'),
    topics: list('topics'),
    sentiments: list('sentiments'),
    riskLevels: list('riskLevels'),
    verification: list('verification'),
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    withinDays: params.get('withinDays') ? Number(params.get('withinDays')) : undefined,
    bookmarkedOnly: params.get('bookmarkedOnly') === 'true' || undefined,
    importantOnly: params.get('importantOnly') === 'true' || undefined,
    includeDemo: params.get('includeDemo') === 'false' ? false : undefined,
    sort: (validSort.includes(params.get('sort') as FeedQuery['sort']) ? sort : 'recent') as FeedQuery['sort'],
  };
}

/** Serialises the filter state into the API query string. */
function buildQueryString(query: FeedQuery, page: number): string {
  const params = new URLSearchParams();
  const setList = (key: string, values?: string[]) => {
    if (values?.length) params.set(key, values.join(','));
  };
  if (query.q) params.set('q', query.q);
  setList('companies', query.companies);
  setList('groups', query.groups);
  setList('brands', query.brands);
  setList('sources', query.sources);
  setList('sourceTypes', query.sourceTypes);
  setList('countries', query.countries);
  setList('languages', query.languages);
  setList('categories', query.categories);
  setList('sentiments', query.sentiments);
  setList('riskLevels', query.riskLevels);
  setList('verification', query.verification);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.withinDays) params.set('withinDays', String(query.withinDays));
  if (query.bookmarkedOnly) params.set('bookmarkedOnly', 'true');
  if (query.importantOnly) params.set('importantOnly', 'true');
  if (query.includeDemo === false) params.set('includeDemo', 'false');
  params.set('sort', query.sort ?? 'recent');
  params.set('page', String(page));
  params.set('pageSize', String(PAGE_SIZE));
  return params.toString();
}

export function FeedClient() {
  const searchParams = useSearchParams();
  const { push } = useToast();
  const { dataVersion } = useRefresh();

  const [view, setView] = React.useState<'cards' | 'table'>('cards');
  const [page, setPage] = React.useState(1);
  const [accumulated, setAccumulated] = React.useState<FeedArticle[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [exportArticle, setExportArticle] = React.useState<FeedArticle | null>(null);
  const [detailArticle, setDetailArticle] = React.useState<FeedArticle | null>(null);
  const [saveViewOpen, setSaveViewOpen] = React.useState(false);
  const [viewName, setViewName] = React.useState('');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // Seed from the URL so a link carrying filters lands on exactly that view.
  const [query, setQuery] = React.useState<FeedQuery>(() => queryFromUrl(searchParams));

  // Re-seed whenever the URL changes — a new deep link, or the header search
  // box writing `q`. Adjusting state during render is React's documented
  // alternative to a syncing effect.
  const urlKey = searchParams.toString();
  const [lastUrlKey, setLastUrlKey] = React.useState(urlKey);
  if (urlKey !== lastUrlKey) {
    setLastUrlKey(urlKey);
    setQuery(queryFromUrl(searchParams));
    setPage(1);
    setAccumulated([]);
  }

  const queryString = buildQueryString(query, page);
  const { data, loading, error, reload } = useApi<Paged<FeedArticle>>(
    `/api/feed?${queryString}`,
    [dataVersion],
  );

  const { data: options } = useApi<FilterOptions>('/api/filters', [dataVersion]);
  const { data: savedViews, reload: reloadViews } = useApi<{
    items: Array<{ id: string; name: string; query: Record<string, unknown> }>;
  }>('/api/saved-views', []);

  // Page 1 replaces the list; later pages append (infinite-scroll behaviour).
  // Keyed on the response object so each payload is folded in exactly once.
  const [lastPayload, setLastPayload] = React.useState<Paged<FeedArticle> | null>(null);
  if (data && data !== lastPayload) {
    setLastPayload(data);
    setAccumulated((current) => (data.page === 1 ? data.items : [...current, ...data.items]));
  }

  const patchQuery = (patch: Partial<FeedQuery>) => {
    setPage(1);
    setAccumulated([]);
    setQuery((current) => ({ ...current, ...patch }));
  };

  const resetFilters = () => {
    setPage(1);
    setAccumulated([]);
    setQuery({ q: query.q, sort: query.sort });
  };

  const optimisticUpdate = (id: string, patch: Partial<FeedArticle>) => {
    setAccumulated((current) => current.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setDetailArticle((current) => (current?.id === id ? { ...current, ...patch } : current));
  };

  const toggleBookmark = async (article: FeedArticle) => {
    optimisticUpdate(article.id, { bookmarked: !article.bookmarked });
    try {
      const result = await mutate<{ bookmarked: boolean }>('/api/bookmarks', {
        body: { articleId: article.id },
      });
      optimisticUpdate(article.id, { bookmarked: result.bookmarked });
    } catch (err) {
      optimisticUpdate(article.id, { bookmarked: article.bookmarked });
      push({
        tone: 'error',
        title: 'Could not update the bookmark',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const toggleImportant = async (article: FeedArticle) => {
    optimisticUpdate(article.id, { important: !article.important });
    try {
      const result = await mutate<{ important: boolean }>('/api/important', {
        body: { articleId: article.id },
      });
      optimisticUpdate(article.id, { important: result.important });
      push({
        tone: 'success',
        title: result.important ? 'Added to the briefing shortlist' : 'Removed from the briefing shortlist',
      });
    } catch (err) {
      optimisticUpdate(article.id, { important: article.important });
      push({
        tone: 'error',
        title: 'Could not update the shortlist',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const bulkAddToBriefing = async () => {
    const ids = Array.from(selected);
    const targets = accumulated.filter((a) => ids.includes(a.id) && !a.important);
    let added = 0;
    for (const article of targets) {
      try {
        await mutate('/api/important', { body: { articleId: article.id } });
        optimisticUpdate(article.id, { important: true });
        added += 1;
      } catch {
        /* Continue with the rest; a partial failure is reported below. */
      }
    }
    setSelected(new Set());
    push({
      tone: added === targets.length ? 'success' : 'info',
      title: `${added} of ${targets.length} added to the briefing shortlist`,
      description: added < targets.length ? 'Some stories could not be added.' : undefined,
    });
  };

  const saveCurrentView = async () => {
    if (!viewName.trim()) return;
    try {
      await mutate('/api/saved-views', { body: { name: viewName.trim(), query } });
      setSaveViewOpen(false);
      setViewName('');
      reloadViews();
      push({ tone: 'success', title: 'View saved', description: viewName.trim() });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not save this view',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const actions: ArticleActions = {
    onToggleBookmark: (a) => void toggleBookmark(a),
    onToggleImportant: (a) => void toggleImportant(a),
    onExportPng: setExportArticle,
    onOpenDetail: setDetailArticle,
    onSelect: (id, isSelected) =>
      setSelected((current) => {
        const next = new Set(current);
        if (isSelected) next.add(id);
        else next.delete(id);
        return next;
      }),
    selectedIds: selected,
    selectable: true,
  };

  const hasMore = data ? data.page < data.totalPages : false;
  const showingCount = accumulated.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <Newspaper className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            Live news feed
          </h1>
          <p className="mt-0.5 text-xs text-subtle">
            Headlines and syndicated descriptions from the configured sources, de-duplicated,
            clustered and scored. Open the original for the full report.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
            Filters
          </Button>

          <label htmlFor="feed-sort" className="sr-only">Sort stories</label>
          <Select
            id="feed-sort"
            value={query.sort ?? 'recent'}
            onChange={(event) => patchQuery({ sort: event.target.value as FeedQuery['sort'] })}
            className="w-52"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>Sort: {option.label}</option>
            ))}
          </Select>

          <div className="flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label="View mode">
            <Button
              size="sm"
              variant={view === 'cards' ? 'secondary' : 'ghost'}
              onClick={() => setView('cards')}
              aria-pressed={view === 'cards'}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              Cards
            </Button>
            <Button
              size="sm"
              variant={view === 'table' ? 'secondary' : 'ghost'}
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
            >
              <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
              Table
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setSaveViewOpen(true)}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Save view
          </Button>
        </div>
      </div>

      {savedViews?.items?.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-subtle">Saved views:</span>
          {savedViews.items.map((saved) => (
            <span key={saved.id} className="inline-flex items-center">
              <button
                onClick={() => {
                  setPage(1);
                  setAccumulated([]);
                  setQuery(saved.query as FeedQuery);
                }}
                className="rounded-l-md border border-r-0 border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {saved.name}
              </button>
              <button
                onClick={async () => {
                  await mutate(`/api/saved-views?id=${saved.id}`, { method: 'DELETE' });
                  reloadViews();
                }}
                aria-label={`Delete saved view ${saved.name}`}
                className="rounded-r-md border border-[var(--border)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] text-subtle hover:text-[var(--color-negative)]"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--bg-inset)] p-2.5">
          <Badge tone="accent">{selected.size} selected</Badge>
          <Button size="sm" variant="primary" onClick={() => void bulkAddToBriefing()}>
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            Add to briefing
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set(accumulated.map((a) => a.id)))}
          >
            Select all loaded
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className="flex gap-5">
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="sticky top-20 p-3">
            <FilterPanel
              options={options ?? null}
              query={query}
              onChange={patchQuery}
              onReset={resetFilters}
              resultCount={data?.total}
            />
          </Card>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          {error ? (
            <ErrorState title="Could not load the feed" message={error} onRetry={reload} />
          ) : null}

          {loading && accumulated.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-44 w-full" />
              ))}
            </div>
          ) : null}

          {!loading && !error && accumulated.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="h-6 w-6" aria-hidden="true" />}
              title="No stories match these filters"
              description="Try widening the date range, clearing some filters, or pressing “Refresh news” to collect the latest items."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear all filters
                </Button>
              }
            />
          ) : null}

          {accumulated.length > 0 ? (
            view === 'cards' ? (
              <div className="space-y-3">
                {accumulated.map((article) => (
                  <ArticleCard key={article.id} article={article} actions={actions} />
                ))}
              </div>
            ) : (
              <ArticleTable articles={accumulated} actions={actions} />
            )
          ) : null}

          {accumulated.length > 0 ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-[11px] text-subtle">
                Showing {showingCount.toLocaleString('en-IN')} of{' '}
                {(data?.total ?? 0).toLocaleString('en-IN')} stories
              </p>
              {hasMore ? (
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  loading={loading}
                >
                  {loading ? 'Loading…' : 'Load more stories'}
                </Button>
              ) : (
                <p className="text-[11px] text-subtle">End of results.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={resetFilters}>Clear all</Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Show {(data?.total ?? 0).toLocaleString('en-IN')} stories
            </Button>
          </>
        }
      >
        <FilterPanel
          options={options ?? null}
          query={query}
          onChange={patchQuery}
          onReset={resetFilters}
          resultCount={data?.total}
        />
      </Modal>

      <Modal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title="Save this view"
        description="Stores the current filters and sort order so you can return to them in one click."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void saveCurrentView()} disabled={!viewName.trim()}>
              Save view
            </Button>
          </>
        }
      >
        <label className="block text-xs font-medium">
          View name
          <Input
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="e.g. Ola Electric — high risk only"
            className="mt-1"
            autoFocus
          />
        </label>
      </Modal>

      <ExportPngDialog
        article={exportArticle}
        open={!!exportArticle}
        onClose={() => setExportArticle(null)}
      />

      <StoryDetail
        article={detailArticle}
        open={!!detailArticle}
        onClose={() => setDetailArticle(null)}
        onExportPng={(article) => {
          setDetailArticle(null);
          setExportArticle(article);
        }}
        onToggleImportant={(article) => void toggleImportant(article)}
      />

      {loading && accumulated.length > 0 ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <span className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs shadow-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading…
          </span>
        </div>
      ) : null}
    </div>
  );
}
