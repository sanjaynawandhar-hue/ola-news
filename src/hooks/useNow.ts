'use client';

import * as React from 'react';

/**
 * A timestamp that is stable within a render and refreshes on an interval.
 *
 * Calling `Date.now()` directly in a component body makes the render impure —
 * two renders with identical props can produce different output, which breaks
 * React's assumptions (and is flagged by react-hooks/purity). Deadline and
 * "overdue" calculations read from here instead, which also keeps them ticking
 * without a page reload.
 */
export function useNow(intervalMs = 60000): number {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
