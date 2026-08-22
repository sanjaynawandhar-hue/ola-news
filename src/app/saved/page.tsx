import { SavedClient } from '@/components/feed/SavedClient';

export const metadata = { title: 'Bookmarks & shortlist' };
export const dynamic = 'force-dynamic';

export default function SavedPage() {
  return <SavedClient />;
}
