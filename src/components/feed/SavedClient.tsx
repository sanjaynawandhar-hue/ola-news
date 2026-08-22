'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bookmark, Star } from 'lucide-react';
import { Button, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui';
import { ArticleCard, type ArticleActions } from './ArticleCard';
import { ExportPngDialog } from './ExportPngDialog';
import { StoryDetail } from './StoryDetail';
import { useApi, mutate } from '@/hooks/useApi';
import { useToast } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import type { FeedArticle } from '@/types';

export function SavedClient() {
  const { push } = useToast();
  const { dataVersion } = useRefresh();
  const [tab, setTab] = React.useState<'bookmarks' | 'shortlist'>('bookmarks');
  const [exportArticle, setExportArticle] = React.useState<FeedArticle | null>(null);
  const [detailArticle, setDetailArticle] = React.useState<FeedArticle | null>(null);

  const bookmarks = useApi<{ items: FeedArticle[]; total: number }>('/api/bookmarks', [dataVersion]);
  const shortlist = useApi<{ items: FeedArticle[]; total: number }>('/api/important', [dataVersion]);

  const active = tab === 'bookmarks' ? bookmarks : shortlist;
  const items = active.data?.items ?? [];

  const toggleBookmark = async (article: FeedArticle) => {
    try {
      await mutate('/api/bookmarks', { body: { articleId: article.id } });
      bookmarks.reload();
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not update the bookmark',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const toggleImportant = async (article: FeedArticle) => {
    try {
      await mutate('/api/important', { body: { articleId: article.id } });
      shortlist.reload();
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not update the shortlist',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const actions: ArticleActions = {
    onToggleBookmark: (a) => void toggleBookmark(a),
    onToggleImportant: (a) => void toggleImportant(a),
    onExportPng: setExportArticle,
    onOpenDetail: setDetailArticle,
    selectable: false,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Bookmark className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Bookmarks &amp; shortlist
        </h1>
        <p className="mt-0.5 text-xs text-subtle">
          Bookmarks are your personal reading list. The shortlist is what goes into the next
          PowerPoint briefing.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={(next) => setTab(next as 'bookmarks' | 'shortlist')}
        tabs={[
          { value: 'bookmarks', label: 'Bookmarks', count: bookmarks.data?.total },
          { value: 'shortlist', label: 'Briefing shortlist', count: shortlist.data?.total },
        ]}
        className="max-w-md"
      />

      {active.error ? (
        <ErrorState title="Could not load these stories" message={active.error} onRetry={active.reload} />
      ) : null}

      {active.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={tab === 'bookmarks' ? <Bookmark className="h-6 w-6" aria-hidden="true" /> : <Star className="h-6 w-6" aria-hidden="true" />}
          title={tab === 'bookmarks' ? 'No bookmarks yet' : 'Nothing shortlisted yet'}
          description={
            tab === 'bookmarks'
              ? 'Bookmark a story from the feed to keep it here for later.'
              : 'Use “Add to briefing” on a story to shortlist it for the next PowerPoint export.'
          }
          action={
            <Link href="/feed">
              <Button variant="primary" size="sm">Open the news feed</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((article) => (
            <ArticleCard key={article.id} article={article} actions={actions} />
          ))}
        </div>
      )}

      {tab === 'shortlist' && items.length > 0 ? (
        <Link href="/briefing">
          <Button variant="primary">Build the briefing from these {items.length} stories</Button>
        </Link>
      ) : null}

      <ExportPngDialog article={exportArticle} open={!!exportArticle} onClose={() => setExportArticle(null)} />
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
    </div>
  );
}
