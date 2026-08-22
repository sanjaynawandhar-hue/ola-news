'use client';

import * as React from 'react';

/**
 * A timestamp that is stable within a render and refreshes on an interval.
 *
 * Two problems this solves:
 *
 *  - Calling `Date.now()` in a component body makes the render impure: two
 *    renders with identical props produce different output, which breaks
 *    React's assumptions (and is flagged by react-hooks/purity).
 *  - The server and the client would produce different values, so anything
 *    rendered from it hydrates with a mismatch.
 *
 * The clock is an external source, so it is subscribed to rather than mirrored
 * into state from an effect. **On the server, and on the first client render,
 * this returns 0** — callers must treat 0 as "the clock is not known yet"
 * rather than as the epoch, or a deadline comparison will report everything as
 * decades overdue on first paint.
 */

/** Shared tick, so many components on a page do not each hold a timer. */
let currentTime = 0;
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * How often the shared clock advances. Fixed rather than per-caller: the tick
 * only drives relative labels and deadline colouring, and a module-level value
 * must not be reassigned during render.
 */
const TICK_MS = 60_000;

function start() {
  if (timer) return;
  currentTime = Date.now();
  timer = setInterval(() => {
    currentTime = Date.now();
    for (const notify of subscribers) notify();
  }, TICK_MS);
}

function subscribe(onChange: () => void) {
  const first = subscribers.size === 0;
  subscribers.add(onChange);
  if (first) {
    start();
    // The store had no value before this; publish the initial read so the
    // first mounted consumer re-renders with a real time.
    queueMicrotask(onChange);
  } else if (currentTime === 0) {
    currentTime = Date.now();
  }

  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Cached, so repeated calls in one render return an identical value. */
function getSnapshot() {
  return currentTime;
}

/** The server has no meaningful clock for the viewer; 0 means "unknown". */
function getServerSnapshot() {
  return 0;
}

export function useNow(): number {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
