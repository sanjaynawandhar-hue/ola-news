import { Suspense } from 'react';
import { OverviewClient } from '@/components/dashboard/OverviewClient';
import { Skeleton } from '@/components/ui';

export const metadata = { title: 'Executive overview' };
export const dynamic = 'force-dynamic';

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewClient />
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80 w-full xl:col-span-2" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
