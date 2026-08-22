import { BriefingClient } from '@/components/briefing/BriefingClient';

export const metadata = { title: 'Briefings & exports' };
export const dynamic = 'force-dynamic';

export default function BriefingPage() {
  return <BriefingClient />;
}
