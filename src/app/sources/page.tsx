import { SourcesClient } from '@/components/sources/SourcesClient';

export const metadata = { title: 'Sources' };
export const dynamic = 'force-dynamic';

export default function SourcesPage() {
  return <SourcesClient />;
}
