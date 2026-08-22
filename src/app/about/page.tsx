import { AboutClient } from '@/components/about/AboutClient';

export const metadata = { title: 'About the companies' };
export const dynamic = 'force-dynamic';

export default function AboutPage() {
  return <AboutClient />;
}
