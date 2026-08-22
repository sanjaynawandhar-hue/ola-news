import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/layout/AppShell';
import { getSettings } from '@/lib/settings';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Ola News — executive news intelligence',
    template: '%s · Ola News',
  },
  description:
    'Executive news intelligence for ANI Technologies / Ola Cabs, Ola Electric and Krutrim: live news, regulatory tracking, risk and sentiment analysis, PNG cards and PowerPoint briefings.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F9F8' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1512' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies the stored theme before first paint so a dark-mode user never
          sees a light flash. Kept inline and minimal by design.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=${JSON.stringify(settings.theme)};var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-[var(--bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          Skip to content
        </a>
        <Providers initialSettings={settings}>
          <AppShell>
            <div id="main-content">{children}</div>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
