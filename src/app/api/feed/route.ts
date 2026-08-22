import { withApi, ok, parseQuery } from '@/lib/api';
import { feedQuerySchema } from '@/lib/validation';
import { getFeed } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const query = parseQuery(request, feedQuerySchema);
  const result = await getFeed(query);
  return ok(result);
});
