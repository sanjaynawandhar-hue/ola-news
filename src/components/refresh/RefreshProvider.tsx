'use client';

import * as React from 'react';
import { useSettings, useToast } from '@/components/providers';
import type { RefreshSummary } from '@/types';

export interface SourceFailureRow {
  sourceKey: string;
  sourceName: string;
  stage: string;
  message: string;
  statusCode?: number | null;
  occurredAt: string;
}

interface RefreshContextValue {
  running: boolean;
  job: RefreshSummary | null;
  failures: SourceFailureRow[];
  lastSuccessAt: string | null;
  error: string | null;
  /** Increments after every completed refresh so pages can re-fetch. */
  dataVersion: number;
  start: () => Promise<void>;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const RefreshContext = React.createContext<RefreshContextValue | null>(null);

export function useRefresh() {
  const ctx = React.useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used inside <RefreshProvider>');
  return ctx;
}

const POLL_MS = 1200;

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { push } = useToast();

  const [job, setJob] = React.useState<RefreshSummary | null>(null);
  const [failures, setFailures] = React.useState<SourceFailureRow[]>([]);
  const [lastSuccessAt, setLastSuccessAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dataVersion, setDataVersion] = React.useState(0);
  const [panelOpen, setPanelOpen] = React.useState(false);

  const jobIdRef = React.useRef<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // A ref guard makes the button idempotent even across rapid double clicks,
  // before React has re-rendered with the new running state.
  const startingRef = React.useRef(false);

  const running = job?.status === 'RUNNING';

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = React.useCallback(async () => {
    const jobId = jobIdRef.current;
    if (!jobId) return;
    try {
      const response = await fetch(`/api/refresh/status?jobId=${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = (await response.json()) as { job: RefreshSummary; failures: SourceFailureRow[] };
      setJob(data.job);
      setFailures(data.failures);

      if (data.job.status !== 'RUNNING') {
        stopPolling();
        jobIdRef.current = null;
        startingRef.current = false;
        setDataVersion((v) => v + 1);

        if (data.job.status === 'FAILED') {
          setError(data.job.error ?? 'Every source failed during this refresh.');
          push({
            tone: 'error',
            title: 'Refresh failed',
            description: data.job.error ?? 'No source could be contacted. Check the Sources page.',
          });
        } else {
          setLastSuccessAt(data.job.finishedAt);
          push({
            tone: data.job.sourcesFailed > 0 ? 'info' : 'success',
            title:
              data.job.sourcesFailed > 0
                ? `Refresh finished with ${data.job.sourcesFailed} source failure(s)`
                : 'Refresh complete',
            description:
              `${data.job.itemsNew} new item(s), ${data.job.duplicatesRemoved} duplicate(s) removed` +
              (data.job.alertsRaised > 0 ? `, ${data.job.alertsRaised} alert(s) raised.` : '.'),
          });
        }
      }
    } catch {
      // Network hiccups during polling are non-fatal; the next tick retries.
    }
  }, [push, stopPolling]);

  const start = React.useCallback(async () => {
    if (startingRef.current || running) return;
    startingRef.current = true;
    setError(null);
    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? 'Could not start a refresh.');
      }
      jobIdRef.current = data.jobId;
      setPanelOpen(true);
      setJob({
        jobId: data.jobId, status: 'RUNNING', startedAt: new Date().toISOString(), finishedAt: null,
        sourcesTotal: 0, sourcesCompleted: 0, sourcesOk: 0, sourcesFailed: 0,
        itemsFetched: 0, itemsNew: 0, duplicatesRemoved: 0, alertsRaised: 0, progress: [],
      });
      stopPolling();
      pollRef.current = setInterval(() => void poll(), POLL_MS);
      void poll();
    } catch (err) {
      startingRef.current = false;
      const message = err instanceof Error ? err.message : 'Could not start a refresh.';
      setError(message);
      push({ tone: 'error', title: 'Refresh could not start', description: message });
    }
  }, [poll, push, running, stopPolling]);

  // Recover the last successful refresh, and reattach to a job already running
  // on the server (for example after a page reload mid-refresh).
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/refresh', { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        setLastSuccessAt(data.lastSuccessAt ?? null);
        if (data.runningJobId) {
          jobIdRef.current = data.runningJobId;
          startingRef.current = true;
          setJob({
            jobId: data.runningJobId, status: 'RUNNING', startedAt: new Date().toISOString(),
            finishedAt: null, sourcesTotal: 0, sourcesCompleted: 0, sourcesOk: 0, sourcesFailed: 0,
            itemsFetched: 0, itemsNew: 0, duplicatesRemoved: 0, alertsRaised: 0, progress: [],
          });
          pollRef.current = setInterval(() => void poll(), POLL_MS);
          void poll();
        }
      } catch {
        /* Non-fatal: the header simply shows "never" until the first refresh. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [poll]);

  // Optional automatic refresh interval, configured in Settings.
  React.useEffect(() => {
    const minutes = settings.autoRefreshMinutes;
    if (!minutes || minutes <= 0) return;
    const timer = setInterval(() => {
      if (!startingRef.current) void start();
    }, minutes * 60000);
    return () => clearInterval(timer);
  }, [settings.autoRefreshMinutes, start]);

  React.useEffect(() => stopPolling, [stopPolling]);

  return (
    <RefreshContext.Provider
      value={{ running, job, failures, lastSuccessAt, error, dataVersion, start, panelOpen, setPanelOpen }}
    >
      {children}
    </RefreshContext.Provider>
  );
}
