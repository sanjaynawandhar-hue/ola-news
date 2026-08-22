import { prisma } from '@/lib/db';
import { serverEnv } from '@/lib/env';
import { SETTING_KEYS } from '@/lib/constants';
import { parseJson, stringifyJson } from '@/lib/utils';
import type { BrandingConfig } from '@/types';

/**
 * Application settings live in the Setting table so they can be changed at
 * runtime from the Settings page. Environment variables provide the defaults.
 */
export async function getSettings(): Promise<BrandingConfig> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const read = <T>(key: string, fallback: T): T => parseJson<T>(map.get(key), fallback);

  return {
    personalName: read(SETTING_KEYS.brandName, serverEnv.brandName),
    showPersonalBranding: read(SETTING_KEYS.showPersonalBranding, true),
    logoPath: read(SETTING_KEYS.logoPath, serverEnv.logoPath),
    logoAttribution: read(
      SETTING_KEYS.logoAttribution,
      'Placeholder mark. Replace with the official Ola logo supplied by the brand owner.',
    ),
    timezone: read(SETTING_KEYS.timezone, serverEnv.defaultTimezone),
    autoRefreshMinutes: read(SETTING_KEYS.autoRefreshMinutes, 0),
    theme: read(SETTING_KEYS.theme, 'system'),
    relevanceThreshold: read(SETTING_KEYS.relevanceThreshold, 25),
    demoDataEnabled: read(SETTING_KEYS.demoDataEnabled, serverEnv.enableDemoData),
  };
}

export async function updateSettings(patch: Partial<BrandingConfig>): Promise<BrandingConfig> {
  const entries: Array<[string, unknown]> = [];
  if (patch.personalName !== undefined) entries.push([SETTING_KEYS.brandName, patch.personalName]);
  if (patch.showPersonalBranding !== undefined) entries.push([SETTING_KEYS.showPersonalBranding, patch.showPersonalBranding]);
  if (patch.logoPath !== undefined) entries.push([SETTING_KEYS.logoPath, patch.logoPath]);
  if (patch.logoAttribution !== undefined) entries.push([SETTING_KEYS.logoAttribution, patch.logoAttribution]);
  if (patch.timezone !== undefined) entries.push([SETTING_KEYS.timezone, patch.timezone]);
  if (patch.autoRefreshMinutes !== undefined) entries.push([SETTING_KEYS.autoRefreshMinutes, patch.autoRefreshMinutes]);
  if (patch.theme !== undefined) entries.push([SETTING_KEYS.theme, patch.theme]);
  if (patch.relevanceThreshold !== undefined) entries.push([SETTING_KEYS.relevanceThreshold, patch.relevanceThreshold]);
  if (patch.demoDataEnabled !== undefined) entries.push([SETTING_KEYS.demoDataEnabled, patch.demoDataEnabled]);

  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: stringifyJson(value) },
      update: { value: stringifyJson(value) },
    });
  }
  return getSettings();
}
