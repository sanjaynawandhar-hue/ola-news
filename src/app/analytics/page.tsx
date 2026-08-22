import { Suspense } from 'react';
import { AnalyticsClient } from '@/components/dashboard/AnalyticsClient';
import { Skeleton } from '@/components/ui';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AnalyticsClient />
    </Suspense>
  );
}
