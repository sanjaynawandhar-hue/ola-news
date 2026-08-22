import { AlertsClient } from '@/components/alerts/AlertsClient';

export const metadata = { title: 'Alerts' };
export const dynamic = 'force-dynamic';

export default function AlertsPage() {
  return <AlertsClient />;
}
