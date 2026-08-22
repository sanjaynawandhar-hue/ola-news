import { DEFAULT_TIMEZONE } from './constants';

/**
 * All display formatting funnels through here so the dashboard timezone
 * (Indian Standard Time by default) is applied consistently.
 */

export function formatDateTime(
  value: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...opts,
  }).format(date);
}

export function formatDate(
  value: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTimeZoneAbbr(timeZone: string = DEFAULT_TIMEZONE): string {
  if (timeZone === DEFAULT_TIMEZONE) return 'IST';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(
      new Date(),
    );
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function relativeTime(value: Date | string | number | null | undefined, now = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'just now';
}

/** Day key (YYYY-MM-DD) in the display timezone — used to bucket trend charts. */
export function dayKey(value: Date | string | number, timeZone: string = DEFAULT_TIMEZONE): string {
  const date = toDate(value) ?? new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

export function daysAgo(days: number, from = new Date()): Date {
  return new Date(from.getTime() - days * 86400000);
}

export function hoursAgo(hours: number, from = new Date()): Date {
  return new Date(from.getTime() - hours * 3600000);
}

export const SUPPORTED_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
];
