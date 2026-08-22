import { SettingsClient } from '@/components/settings/SettingsClient';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return <SettingsClient />;
}
