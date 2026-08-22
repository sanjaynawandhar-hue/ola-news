import { withApi, ok, parseQuery } from '@/lib/api';
import { getMarketSnapshot, toRelativePerformance } from '@/lib/market/quotes';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  range: z.enum(['5d', '1mo', '3mo', '6mo', '1y']).optional(),
});

export const GET = withApi(
  async (request) => {
    const { range } = parseQuery(request, querySchema);
    const snapshot = await getMarketSnapshot({ range: range ?? '1mo' });
    return ok({ ...snapshot, relative: toRelativePerformance(snapshot.quotes) });
  },
  { limit: 120, bucket: 'market' },
);
