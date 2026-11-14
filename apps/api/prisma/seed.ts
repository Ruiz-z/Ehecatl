import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { NasaService } from '../src/modules/nasa-data/nasa.service.js';
import { normalizeWeights } from '../src/modules/farm-context/priorities/normalize.js';
import { cropId, coordinates } from '../src/modules/farm-context/validation.js';
import { recommend } from '../src/modules/rotation-engine/engine/sequences.js';
import type { Weights } from '../src/modules/nasa-data/contracts.js';

interface Profile { key: string; email: string; name: string; lat: number; lon: number; currentCropId: string; previousCropId: string; irrigated: boolean; priorities: Weights }
const password = process.env.SEED_DEMO_PASSWORD;
if (!password || Buffer.byteLength(password) < 12 || Buffer.byteLength(password) > 72) throw new Error('SEED_DEMO_PASSWORD requires 12–72 bytes; no password is committed');
const profileFile = resolve(process.env.SEED_PROFILES_PATH ?? 'prisma/demo-profiles.json');
const profiles = JSON.parse(readFileSync(profileFile, 'utf8')) as Profile[];
if (!Array.isArray(profiles) || profiles.length < 3 || new Set(profiles.map(p => p.email)).size !== profiles.length ||
    new Set(profiles.map(p => p.key)).size !== profiles.length || profiles.some(p => p.email === 'admin@demo.ehecatl')) throw new Error('At least three unique demo profiles required');
for (const p of profiles) { coordinates(p.lat, p.lon); cropId(p.currentCropId); cropId(p.previousCropId); normalizeWeights(p.priorities); }

function id(key: string) {
  const hash = createHash('sha256').update(`ehecatl:demo:${key}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
const prisma = new PrismaService();
try {
  await prisma.$connect();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({ where: { email: 'admin@demo.ehecatl' }, create: { email: 'admin@demo.ehecatl', name: 'Administración demo', role: 'ADMIN', passwordHash }, update: { passwordHash, role: 'ADMIN' } });
  const nasa = new NasaService(prisma);
  for (const profile of profiles) {
    const user = await prisma.user.upsert({ where: { email: profile.email }, create: { email: profile.email, name: profile.name, passwordHash }, update: { name: profile.name, passwordHash } });
    const priorities = normalizeWeights(profile.priorities);
    const parcelId = id(`${profile.key}:parcel`), zoneId = id(`${profile.key}:zone`);
    // Un reintento no duplica perfiles ni deja contexto a medias.
    await prisma.$transaction(async tx => {
      await tx.priorities.upsert({ where: { userId: user.id }, create: { userId: user.id, ...priorities }, update: priorities });
      const parcel = { ownerId: user.id, name: `Parcela demo ${profile.key}`, lat: profile.lat, lon: profile.lon };
      await tx.parcel.upsert({ where: { id: parcelId }, create: { id: parcelId, ...parcel }, update: parcel });
      const zone = { parcelId, name: 'Zona principal', currentCropId: profile.currentCropId, irrigated: profile.irrigated };
      await tx.zone.upsert({ where: { id: zoneId }, create: { id: zoneId, ...zone }, update: zone });
      const year = new Date().getUTCFullYear()-1;
      const history = { zoneId, cropId: profile.previousCropId, plantedAt: new Date(Date.UTC(year, 0, 1)), harvestedAt: new Date(Date.UTC(year, 4, 1)) };
      await tx.cropHistory.upsert({ where: { id: id(`${profile.key}:history`) }, create: { id: id(`${profile.key}:history`), ...history }, update: history });
    });
    const data = await nasa.get(profile.lat, profile.lon, profile.irrigated);
    if (data.origin === 'mock' || data.sources.power.status === 'unavailable' || data.monthly.length === 0 || data.windows.length === 0) throw new Error(`No real usable NASA data for ${profile.key}; rerun seed when upstream recovers`);
    const result = recommend({ currentCropId: profile.currentCropId, history: [{ cropId: profile.previousCropId, plantedAt: '2024-01-01', harvestedAt: '2024-05-01' }], priorities, indicators: data });
    console.info(`${profile.key}: zone=${zoneId}; origin=${data.origin}; sources=${JSON.stringify(data.sources)}; top=${result.recommendations[0]?.id ?? result.status}`);
  }
  console.info('Seed completo con NASA real. Perfiles propuestos: requieren aprobación H3.');
} finally { await prisma.$disconnect(); }
