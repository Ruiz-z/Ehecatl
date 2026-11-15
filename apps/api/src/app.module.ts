import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.js';
import { FarmModule } from './modules/farm-context/farm.controller.js';
import { CropKnowledgeModule } from './modules/crop-knowledge/crops.controller.js';
import { NasaModule } from './modules/nasa-data/nasa.module.js';
import { RotationModule } from './modules/rotation-engine/rotation.controller.js';
import { SensorsModule } from './modules/field-sensors/sensors.controller.js';

@Module({ imports: [PrismaModule, HealthModule, IdentityModule, FarmModule, CropKnowledgeModule, NasaModule, RotationModule, SensorsModule] })
export class AppModule {}
