import { RegulatoryClient } from '@/components/regulatory/RegulatoryClient';

export const metadata = { title: 'Regulatory tracker' };
export const dynamic = 'force-dynamic';

export default function RegulatoryPage() {
  return <RegulatoryClient />;
}
