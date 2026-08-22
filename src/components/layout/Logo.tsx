'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { useSettings } from '@/components/providers';
import { cn } from '@/lib/utils';

/**
 * Renders the configured logo at its natural aspect ratio — never stretched.
 * If the file is missing or fails to load, a neutral placeholder mark is shown
 * instead, so the header never breaks and no logo is ever redrawn or distorted.
 */
export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  const { settings } = useSettings();
  const [failed, setFailed] = useState(false);

  if (failed || !settings.logoPath) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-ola-700)] text-[10px] font-bold text-white',
          className,
        )}
        style={{ width: size, height: size }}
      >
        ON
      </span>
    );
  }

  return (
    <img
      src={settings.logoPath}
      alt="Ola News"
      title={settings.logoAttribution}
      onError={() => setFailed(true)}
      className={cn('shrink-0 object-contain', className)}
      style={{ height: size, width: 'auto', maxWidth: size * 3 }}
    />
  );
}
