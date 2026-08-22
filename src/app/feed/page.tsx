import { Suspense } from 'react';
import { FeedClient } from '@/components/feed/FeedClient';
import { Skeleton } from '@/components/ui';

export const metadata = { title: 'Live news feed' };
export const dynamic = 'force-dynamic';

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-56" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      }
    >
      <FeedClient />
    </Suspense>
  );
}
