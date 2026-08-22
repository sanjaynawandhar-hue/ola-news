import { withApi, ok, parseQuery } from '@/lib/api';
import { regulatoryQuerySchema } from '@/lib/validation';
import { getRegulatory } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const query = parseQuery(request, regulatoryQuerySchema);
  return ok(await getRegulatory(query));
});
