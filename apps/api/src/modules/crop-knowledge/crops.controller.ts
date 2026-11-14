import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { IdentityModule, AuthGuard } from '../identity/identity.js';
import { crops, sources } from './crop-catalog.js';

@Controller('crops') @UseGuards(AuthGuard)
export class CropsController {
  @Get() list() { return crops.map(c => ({ ...c, sourceLinks: c.sources.map(key => ({ key, url: sources[key] })) })); }
}
@Module({ imports: [IdentityModule], controllers: [CropsController] })
export class CropKnowledgeModule {}
