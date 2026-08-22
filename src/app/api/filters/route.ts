import { withApi, ok } from '@/lib/api';
import { getFilterOptions } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => ok(await getFilterOptions()));
