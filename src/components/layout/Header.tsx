'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu, Moon, Presentation, RefreshCw, Search, Settings2, Sun, X } from 'lucide-react';
import { Button, Select, Spinner } from '@/components/ui';
import { Logo } from './Logo';
import { Sidebar } from './Sidebar';
import { Notifications } from './Notifications';
import { useSettings, useTheme } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { formatDateTime, formatTimeZoneAbbr, relativeTime } from '@/lib/time';

export const DATE_RANGES = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const { setTheme } = useTheme();
  const { running, start, lastSuccessAt, setPanelOpen, job } = useRefresh();

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // The search box mirrors the `q` URL parameter. React's documented pattern
  // for this is to adjust state during render when the source value changes,
  // rather than writing it from an effect (which renders twice).
  const urlQuery = searchParams.get('q') ?? '';
  const [search, setSearch] = React.useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = React.useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setSearch(urlQuery);
  }

  const range = searchParams.get('range') ?? '30';

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set('q', search.trim());
    else params.delete('q');
    router.push(`/feed?${params.toString()}`);
  };

  const changeRange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-elevated)]/80">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Ola News home">
            <Logo size={28} />
            <span className="hidden text-base font-semibold tracking-tight sm:block">Ola News</span>
          </Link>

          <form onSubmit={submitSearch} className="relative mx-1 min-w-0 flex-1 md:mx-3 md:max-w-lg">
            <label htmlFor="global-search" className="sr-only">
              Search all stories
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-subtle)]"
              aria-hidden="true"
            />
            <input
              id="global-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search headlines, summaries, publishers…"
              className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 text-sm placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]"
            />
          </form>

          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            <label htmlFor="date-range" className="sr-only">
              Date range
            </label>
            <Select
              id="date-range"
              value={range}
              onChange={(event) => changeRange(event.target.value)}
              className="w-40"
            >
              {DATE_RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/*
              The last-refresh time is fetched by the client after mount, and
              this subtree hydrates inside a Suspense boundary — so the server
              markup legitimately differs from the first client paint. React's
              suppressHydrationWarning is the documented escape hatch for
              inherently client-side, time-dependent text.
            */}
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="hidden text-right text-[10.5px] leading-tight text-subtle hover:text-[var(--fg)] 2xl:block"
              suppressHydrationWarning
              title={
                lastSuccessAt
                  ? `${formatDateTime(lastSuccessAt, settings.timezone)} ${formatTimeZoneAbbr(settings.timezone)}`
                  : 'No refresh has completed yet'
              }
            >
              <span className="block">Last refresh</span>
              <span
                className="block font-medium text-[var(--fg-muted)]"
                suppressHydrationWarning
              >
                {lastSuccessAt ? relativeTime(lastSuccessAt) : 'never'}
              </span>
            </button>

            <Button
              variant="primary"
              size="md"
              onClick={() => void start()}
              disabled={running}
              aria-live="polite"
              title={running ? 'A refresh is already running' : 'Fetch the latest items from every enabled source'}
            >
              {running ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {running
                  ? job?.sourcesTotal
                    ? `Refreshing ${job.sourcesCompleted}/${job.sourcesTotal}`
                    : 'Refreshing…'
                  : 'Refresh news'}
              </span>
            </Button>

            <Link href="/briefing">
              <Button variant="outline" size="md" title="Build a PowerPoint briefing">
                <Presentation className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">Generate briefing</span>
              </Button>
            </Link>

            <Notifications />

            {/*
              The server cannot know the visitor's OS colour-scheme, and this
              subtree hydrates inside a Suspense boundary — so a JS-derived icon
              would mismatch. Both icons are rendered and CSS picks one from the
              `dark` class that the inline head script sets before first paint.
              The current theme is read from the DOM at click time.
            */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle light and dark theme"
              onClick={() =>
                setTheme(
                  document.documentElement.classList.contains('dark') ? 'light' : 'dark',
                )
              }
            >
              <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
              <Moon className="block h-4 w-4 dark:hidden" aria-hidden="true" />
            </Button>

            <Link href="/settings" aria-label="Settings">
              <Button variant="ghost" size="icon">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="animate-in relative h-full w-72 max-w-[85vw] border-r border-[var(--border)] bg-[var(--bg-elevated)]">
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-3">
              <span className="flex items-center gap-2">
                <Logo size={26} />
                <span className="font-semibold">Ola News</span>
              </span>
              <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)} aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            <div className="border-t border-[var(--border)] p-3">
              <label htmlFor="mobile-range" className="mb-1 block text-xs text-subtle">
                Date range
              </label>
              <Select
                id="mobile-range"
                value={range}
                onChange={(event) => {
                  changeRange(event.target.value);
                  setMobileNavOpen(false);
                }}
                className="w-full"
              >
                {DATE_RANGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
