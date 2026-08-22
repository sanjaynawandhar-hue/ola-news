'use client';

import { Skeleton } from '@/components/ui';

export function TopList({
  items, loading, emptyMessage = 'Nothing to show for this period.', valueSuffix = '', onSelect,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  loading?: boolean;
  emptyMessage?: string;
  valueSuffix?: string;
  onSelect?: (label: string) => void;
}) {
  if (loading) {
    return (
      <ul className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="flex items-center gap-3">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-8" />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-subtle">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Row = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium" title={item.hint ?? item.label}>
                {item.label}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-subtle">
                {item.value.toLocaleString('en-IN')}
                {valueSuffix}
              </span>
            </span>
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <span
                className="block h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
              />
            </span>
          </>
        );
        return (
          <li key={item.label}>
            {onSelect ? (
              <button
                onClick={() => onSelect(item.label)}
                className="w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--bg-subtle)]"
              >
                {Row}
              </button>
            ) : (
              <div className="px-1 py-0.5">{Row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
