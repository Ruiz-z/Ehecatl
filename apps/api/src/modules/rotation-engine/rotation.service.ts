import { Injectable } from '@nestjs/common';
import type { Actor } from '../identity/identity.js';
import { FarmService } from '../farm-context/farm.service.js';
import { NasaService } from '../nasa-data/nasa.service.js';
import { cropId, objectBody } from '../farm-context/validation.js';
import { normalizeWeights } from '../farm-context/priorities/normalize.js';
import { recommend } from './engine/sequences.js';

@Injectable()
export class RotationService {
  constructor(private readonly farm: FarmService, private readonly nasa: NasaService) {}
  async recommendations(id: string, actor: Actor, preview?: unknown) {
    const zone = await this.farm.zone(id, actor);
    cropId(zone.currentCropId);
    const priorities = preview === undefined ? await this.farm.priorities(zone.parcel.ownerId)
      : normalizeWeights(objectBody(preview, ['priorities']).priorities);
    const indicators = await this.nasa.get(zone.lat ?? zone.parcel.lat, zone.lon ?? zone.parcel.lon, zone.irrigated);
    const recentHistory = zone.history.filter(h => h.harvestedAt >= new Date(Date.UTC(new Date().getUTCFullYear()-2, new Date().getUTCMonth(), new Date().getUTCDate())));
    return { version: 1, zoneId: id, origin: indicators.origin, ...recommend({ currentCropId: zone.currentCropId, history: recentHistory, priorities, indicators }),
      inputs: { point: indicators.point, currentCropId: zone.currentCropId, historyCount: recentHistory.length, indicators } };
  }
}
