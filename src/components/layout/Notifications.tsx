'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Badge, Button, Spinner } from '@/components/ui';
import { useSettings } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

interface NotificationRow {
  id: string;
  alertName: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readAt: string | null;
  createdAt: string;
  article: { id: string; title: string; publisher: string; url: string } | null;
}

export function Notifications() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const { dataVersion } = useRefresh();
  const containerRef = React.useRef<HTMLDivElement>(null);
  useSettings();

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.items);
      setUnread(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  // `loading` starts true and is only cleared once a response lands, so the
  // effect never has to set state synchronously on mount.
  React.useEffect(() => {
    void load();
  }, [load, dataVersion]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    void load();
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-negative)] px-1 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="animate-in absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-sm font-semibold">Alerts</span>
            <div className="flex items-center gap-1">
              {unread > 0 ? (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  Mark all read
                </Button>
              ) : null}
              <Link href="/alerts" onClick={() => setOpen(false)}>
                <Button variant="ghost" size="sm">Manage</Button>
              </Link>
            </div>
          </div>

          <div className="scroll-thin max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-xs text-subtle">
                <Spinner className="h-3.5 w-3.5" /> Loading alerts…
              </div>
            ) : items.length === 0 ? (
              <p className="p-4 text-xs text-subtle">
                No alerts yet. Alerts are raised during a refresh when a story matches one of your
                rules.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn('p-3', !item.readAt && 'bg-[var(--bg-inset)]/60')}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          item.severity === 'CRITICAL'
                            ? 'negative'
                            : item.severity === 'WARNING'
                              ? 'warning'
                              : 'info'
                        }
                      >
                        {item.severity.toLowerCase()}
                      </Badge>
                      <span className="truncate text-[11px] text-subtle">{item.alertName}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-subtle">
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.message}</p>
                    {item.article ? (
                      <Link
                        href={`/feed?q=${encodeURIComponent(item.article.title.slice(0, 60))}`}
                        onClick={() => setOpen(false)}
                        className="mt-1 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        Open in feed
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
