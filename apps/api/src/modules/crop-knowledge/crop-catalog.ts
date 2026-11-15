import { readFileSync } from 'node:fs';

export interface Crop {
  id: string; name: string; family: string;
  tempMin: number; tempMax: number; tempOptMin: number; tempOptMax: number;
  kc: { ini: number; mid: number; end: number }; kcSource: string; kcEstimated?: boolean;
  ky: number; kySource: string; kyEstimated: boolean;
  waterMm: number; waterDemand: 'low' | 'medium' | 'high'; cycleDays: number;
  frostSensitive: boolean; nitrogenBalance: 'fix' | 'neutral' | 'consume';
  soilCover: number; droughtTolerance: number; perennial: boolean;
  plantingClimate: string; incomeOpportunity: number; sources: string[];
  marketValueTier: 'bajo' | 'medio' | 'alto'; marketValueSource: string;
}
export const incomeByTier = { bajo: 25, medio: 60, alto: 90 } as const;
export interface FamilyRule { from: string; to: string; compatibility: 'good' | 'neutral' | 'avoid'; reason: string; sources: string[] }
export const sources: Record<string, string> = {
  ecocrop: 'https://gaez.fao.org/pages/ecocrop',
  fao56: 'https://www.fao.org/4/x0490e/x0490e00.htm',
  fao66: 'https://www.fao.org/4/i2800e/i2800e.pdf',
  'fao-water': 'https://www.fao.org/4/s2022e/s2022e07.htm',
  'sare-rotation': 'https://www.sare.org/resources/crop-rotation-on-organic-farms/',
  'sare-cover': 'https://www.sare.org/resources/managing-cover-crops-profitably-3rd-edition/',
};

export function validateCatalog(input: unknown): Crop[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Catalog must be a nonempty array');
  const ids = new Set<string>();
  for (const raw of input) {
    const crop = raw as Record<string, unknown>;
    const fail = (field: string): never => { throw new Error(`Crop ${String(crop?.id ?? '<unknown>')}: invalid or missing ${field}`); };
    if (!crop || typeof crop !== 'object') fail('crop');
    for (const field of ['id', 'name', 'family', 'plantingClimate']) {
      if (typeof crop[field] !== 'string' || !(crop[field] as string).trim()) fail(field);
    }
    if (ids.has(crop.id as string)) fail('id (duplicate)');
    ids.add(crop.id as string);
    for (const field of ['tempMin', 'tempMax', 'tempOptMin', 'tempOptMax', 'waterMm', 'cycleDays', 'soilCover', 'droughtTolerance', 'incomeOpportunity']) {
      if (typeof crop[field] !== 'number' || !Number.isFinite(crop[field])) fail(field);
    }
    const c = crop as unknown as Crop;
    if (!['bajo', 'medio', 'alto'].includes(c.marketValueTier)) fail('marketValueTier');
    if (typeof c.marketValueSource !== 'string' || !c.marketValueSource.trim()) fail('marketValueSource');
    if (c.incomeOpportunity !== incomeByTier[c.marketValueTier]) fail('incomeOpportunity (inconsistent with marketValueTier)');
    if (!(c.tempMin <= c.tempOptMin && c.tempOptMin <= c.tempOptMax && c.tempOptMax <= c.tempMax)) fail('temperature range');
    if (!c.kc || typeof c.kc !== 'object') fail('kc');
    for (const stage of ['ini', 'mid', 'end'] as const) {
      if (!Number.isFinite(c.kc[stage]) || c.kc[stage] < .1 || c.kc[stage] > 1.4) fail(`kc.${stage}`);
    }
    if (typeof c.kcSource !== 'string' || !c.kcSource.trim()) fail('kcSource');
    if (c.kcEstimated !== undefined && typeof c.kcEstimated !== 'boolean') fail('kcEstimated');
    if (!Number.isFinite(c.ky) || c.ky <= 0) fail('ky');
    if (typeof c.kySource !== 'string' || !c.kySource.trim()) fail('kySource');
    if (typeof c.kyEstimated !== 'boolean') fail('kyEstimated');
    if (c.waterMm <= 0) fail('waterMm');
    if (!Number.isInteger(c.cycleDays) || c.cycleDays < 1) fail('cycleDays');
    for (const field of ['soilCover', 'droughtTolerance', 'incomeOpportunity'] as const) if (c[field] < 0 || c[field] > 100) fail(field);
    for (const field of ['perennial', 'frostSensitive']) if (typeof crop[field] !== 'boolean') fail(field);
    if (!['fix', 'neutral', 'consume'].includes(c.nitrogenBalance)) fail('nitrogenBalance');
    if (!['low', 'medium', 'high'].includes(c.waterDemand)) fail('waterDemand');
    if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some(s => !sources[s])) fail('sources');
  }
  return input as Crop[];
}

export const crops = validateCatalog(JSON.parse(readFileSync(new URL('./data/crops.json', import.meta.url), 'utf8')));
export const familyRules: FamilyRule[] = JSON.parse(readFileSync(new URL('./data/family-transitions.json', import.meta.url), 'utf8'));
for (const family of new Set(crops.map(c => c.family))) {
  for (const to of new Set(crops.map(c => c.family))) {
    const matches = familyRules.filter(rule => rule.from === family && rule.to === to);
    if (matches.length !== 1 || !matches[0].reason || !['good', 'neutral', 'avoid'].includes(matches[0].compatibility) ||
        !matches[0].sources.length || matches[0].sources.some(s => !sources[s])) throw new Error(`Invalid family rule ${family} -> ${to}`);
  }
}

export function findCrop(id: string): Crop | undefined { return crops.find(crop => crop.id === id); }
