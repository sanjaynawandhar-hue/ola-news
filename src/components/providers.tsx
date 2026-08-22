'use client';

import * as React from 'react';
import type { BrandingConfig } from '@/types';

/* ------------------------------------------------------------- Settings -- */

export interface AccessState {
  /** True when the deployment is published in public read-only mode. */
  readOnly: boolean;
  /** True when this visitor may perform write operations. */
  canWrite: boolean;
  adminTokenConfigured: boolean;
}

interface SettingsContextValue {
  settings: BrandingConfig;
  refresh: () => Promise<void>;
  save: (patch: Partial<BrandingConfig>) => Promise<BrandingConfig>;
  saving: boolean;
  access: AccessState;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function useSettings() {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <Providers>');
  return ctx;
}

/** Convenience: true when the visitor may change things. */
export function useCanWrite(): boolean {
  return useSettings().access.canWrite;
}

/* ---------------------------------------------------------------- Theme -- */

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  resolved: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  /**
   * False during the server render and the first client render. Components
   * whose output depends on the *resolved* theme must wait for this, because
   * the server cannot know the visitor's OS colour-scheme preference.
   */
  mounted: boolean;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <Providers>');
  return ctx;
}

/* ---------------------------------------------------------------- Toast -- */

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info';
}

const ToastContext = React.createContext<{
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <Providers>');
  return ctx;
}

/* ------------------------------------------------------------ Providers -- */

function subscribeToColorScheme(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** Never changes; used only to distinguish the server render from the client. */
function subscribeToNothing() {
  return () => {};
}

export function Providers({
  initialSettings,
  children,
}: {
  initialSettings: BrandingConfig;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState(initialSettings);
  const [saving, setSaving] = React.useState(false);
  // Assume writable until the server says otherwise, so a local install never
  // flickers into a disabled state.
  const [access, setAccess] = React.useState<AccessState>({
    readOnly: false,
    canWrite: true,
    adminTokenConfigured: false,
  });

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/access', { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        setAccess((await response.json()) as AccessState);
      } catch {
        /* Non-fatal: the server still refuses unauthorised writes. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [theme, setThemeState] = React.useState<ThemeMode>(
    (initialSettings.theme as ThemeMode) ?? 'system',
  );
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  // The OS colour-scheme is an external store, so it is subscribed to rather
  // than mirrored into state from an effect. The server snapshot is `false`
  // because the server cannot know the visitor's preference.
  const systemDark = React.useSyncExternalStore(
    subscribeToColorScheme,
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    () => false,
  );
  const mounted = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const resolved: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const push = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const refresh = React.useCallback(async () => {
    const response = await fetch('/api/settings', { cache: 'no-store' });
    if (response.ok) setSettings(await response.json());
  }, []);

  const save = React.useCallback(
    async (patch: Partial<BrandingConfig>) => {
      setSaving(true);
      try {
        const response = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message ?? 'Could not save settings.');
        }
        setSettings(data);
        if (patch.theme) setThemeState(patch.theme as ThemeMode);
        return data as BrandingConfig;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const setTheme = React.useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      void save({ theme: mode }).catch(() => {
        /* Theme still applies locally even if persistence fails. */
      });
    },
    [save],
  );

  return (
    <SettingsContext.Provider value={{ settings, refresh, save, saving, access }}>
      <ThemeContext.Provider value={{ theme, resolved, setTheme, mounted }}>
        <ToastContext.Provider value={{ toasts, push, dismiss }}>
          {children}
          <ToastViewport />
        </ToastContext.Provider>
      </ThemeContext.Provider>
    </SettingsContext.Provider>
  );
}

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            'animate-in pointer-events-auto flex items-start gap-3 rounded-xl border p-3 shadow-lg ' +
            (toast.tone === 'error'
              ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950'
              : toast.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950'
                : 'border-[var(--border)] bg-[var(--bg-elevated)]')
          }
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? (
              <p className="mt-0.5 text-xs text-muted">{toast.description}</p>
            ) : null}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-lg leading-none text-[var(--fg-subtle)] hover:text-[var(--fg)]"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
