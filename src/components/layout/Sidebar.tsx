'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Newspaper, Landmark, BarChart3, BellRing, Presentation, Radio, Settings2,
  Bookmark, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Executive overview', icon: LayoutDashboard },
  { href: '/feed', label: 'Live news feed', icon: Newspaper },
  { href: '/regulatory', label: 'Regulatory tracker', icon: Landmark },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/about', label: 'About the companies', icon: Info },
  { href: '/briefing', label: 'Briefings & exports', icon: Presentation },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
  { href: '/saved', label: 'Bookmarks & shortlist', icon: Bookmark },
  { href: '/sources', label: 'Sources', icon: Radio },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex h-full flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--bg-inset)] text-[var(--color-ola-700)] dark:text-[var(--color-ola-300)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
