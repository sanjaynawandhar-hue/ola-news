import { withApi, ok, parseQuery } from '@/lib/api';
import { overviewQuerySchema } from '@/lib/validation';
import { getOverview } from '@/lib/queries';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const { days, groups } = parseQuery(request, overviewQuerySchema);
  const settings = await getSettings();
  const overview = await getOverview({
    days: days ?? 30,
    timezone: settings.timezone,
    groups,
  });
  return ok(overview);
});
