'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Card -- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface rounded-xl', className)} {...props} />;
}

export function CardHeader({
  title, description, action, className, tooltip,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  tooltip?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 pb-2 sm:px-5', className)}>
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="truncate">{title}</span>
          {tooltip ? <InfoTip label={tooltip} /> : null}
        </h3>
        {description ? <p className="mt-0.5 text-xs text-subtle">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 sm:px-5', className)} {...props} />;
}

/* --------------------------------------------------------------- Button -- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-strong)] disabled:hover:bg-[var(--accent)]',
  secondary:
    'bg-[var(--bg-subtle)] text-[var(--fg)] hover:bg-[var(--border)] border border-[var(--border)]',
  outline:
    'bg-transparent text-[var(--fg)] border border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
  ghost: 'bg-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]',
  danger: 'bg-[var(--color-negative)] text-white hover:brightness-110',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-9 w-9 justify-center',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- Badge -- */

export function Badge({
  className, tone = 'neutral', children, ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info' | 'demo';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--bg-subtle)] text-[var(--fg-muted)] border-[var(--border)]',
    accent: 'bg-[var(--color-ola-50)] text-[var(--color-ola-700)] border-[var(--color-ola-200)] dark:bg-[var(--bg-inset)] dark:text-[var(--color-ola-300)] dark:border-[var(--color-ola-800)]',
    positive: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
    negative: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900',
    warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
    info: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900',
    demo: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Tooltip -- */

/**
 * CSS-only tooltip. Uses a native title as the accessible fallback so the
 * information is never visual-only.
 */
export function InfoTip({ label }: { label: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        role="img"
        aria-label={label}
        title={label}
        className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-[var(--border-strong)] text-[9px] font-bold text-[var(--fg-subtle)]"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-[min(15rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-[var(--fg-muted)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/* -------------------------------------------------------- Form controls -- */

export function Select({
  className, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-sm text-[var(--fg)]',
        'focus:border-[var(--accent)]',
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)]',
        'placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-sm text-[var(--fg)]',
        'placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)]',
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  label, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
        {...props}
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

export function Toggle({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start justify-between gap-4', disabled && 'opacity-55')}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-subtle">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------- Feedback -- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} aria-hidden="true" />;
}

export function EmptyState({
  title, description, action, icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-12 text-center">
      {icon ? <div className="text-[var(--fg-subtle)]">{icon}</div> : null}
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="max-w-md text-xs text-subtle">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
    >
      <p className="text-sm font-semibold text-red-900 dark:text-red-200">{title}</p>
      {message ? <p className="text-xs text-red-800 dark:text-red-300">{message}</p> : null}
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Modal -- */

export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-0 sm:items-center sm:p-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-in relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-subtle">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </Button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Tabs -- */

export function Tabs({
  tabs, value, onChange, className,
}: {
  tabs: Array<{ value: string; label: React.ReactNode; count?: number }>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'scroll-thin flex gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm'
                : 'text-[var(--fg-subtle)] hover:text-[var(--fg)]',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded bg-[var(--border)] px-1 text-[10px] tabular-nums">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Progress -- */

export function ProgressBar({
  value, max = 100, tone = 'accent', className,
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'positive' | 'negative' | 'warning';
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const tones = {
    accent: 'bg-[var(--accent)]',
    positive: 'bg-[var(--color-positive)]',
    negative: 'bg-[var(--color-negative)]',
    warning: 'bg-[var(--color-riskMedium)]',
  };
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
