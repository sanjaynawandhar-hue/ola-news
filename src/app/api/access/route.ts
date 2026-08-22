import { withApi, ok } from '@/lib/api';
import { accessState } from '@/lib/access';

export const dynamic = 'force-dynamic';

/** Tells the client whether this visitor may change anything. */
export const GET = withApi(async (request) => ok(accessState(request)));
