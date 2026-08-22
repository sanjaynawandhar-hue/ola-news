'use client';

import { Suspense } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { AppFooter } from './Footer';
import { RefreshPanel } from '@/components/refresh/RefreshPanel';
import { RefreshProvider } from '@/components/refresh/RefreshProvider';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RefreshProvider>
      {/* Header reads search params, so it is suspended for static generation. */}
      <Suspense fallback={<div className="h-14 border-b border-[var(--border)]" />}>
        <Header />
      </Suspense>

      <div className="mx-auto flex w-full max-w-[1800px]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-r border-[var(--border)] lg:block">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="px-4 py-5 sm:px-6 sm:py-6">{children}</div>
          <AppFooter />
        </main>
      </div>

      <RefreshPanel />
    </RefreshProvider>
  );
}
