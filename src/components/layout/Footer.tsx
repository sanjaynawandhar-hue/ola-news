'use client';

import { useSettings } from '@/components/providers';
import { formatTimeZoneAbbr } from '@/lib/time';

export function AppFooter() {
  const { settings } = useSettings();
  return (
    <footer className="mt-8 border-t border-[var(--border)] px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-2 text-[11px] text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl leading-relaxed">
          Summaries, sentiment, risk levels, relevance and importance shown across this dashboard are
          automated estimates with stated confidence — they are not verified facts. Headlines and
          descriptions belong to their publishers; always open the original source before acting.
          Times are shown in {formatTimeZoneAbbr(settings.timezone)}.
        </p>
        {settings.showPersonalBranding && settings.personalName ? (
          <p className="shrink-0 sm:text-right">Prepared for {settings.personalName}</p>
        ) : null}
      </div>
    </footer>
  );
}
