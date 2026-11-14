import { Controller, Get, Module, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { IdentityModule, AuthGuard, type AuthRequest } from '../identity/identity.js';
import { FarmModule } from '../farm-context/farm.controller.js';
import { NasaModule } from '../nasa-data/nasa.module.js';
import { RotationService } from './rotation.service.js';

@Controller('zones') @UseGuards(AuthGuard)
class RotationController {
  constructor(private readonly rotation: RotationService) {}
  @Get(':id/recommendations') recommendations(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.rotation.recommendations(id, req.user); }
}
@Module({ imports: [IdentityModule, FarmModule, NasaModule], controllers: [RotationController], providers: [RotationService] })
export class RotationModule {}
