import { withApi, ok, parseBody } from '@/lib/api';
import { settingsSchema } from '@/lib/validation';
import { getSettings, updateSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => ok(await getSettings()));

export const PUT = withApi(async (request) => {
  const patch = await parseBody(request, settingsSchema);
  return ok(await updateSettings(patch));
});
