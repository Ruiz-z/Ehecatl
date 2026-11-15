import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { IdentityModule, AuthGuard, type AuthRequest } from '../identity/identity.js';
import { FarmModule } from '../farm-context/farm.controller.js';
import { NasaModule } from '../nasa-data/nasa.module.js';
import { RotationService } from './rotation.service.js';

@Controller('zones') @UseGuards(AuthGuard)
class RotationController {
  constructor(private readonly rotation: RotationService) {}
  @Get(':id/recommendations') recommendations(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.rotation.recommendations(id, req.user); }
  @Post(':id/recommendations') @HttpCode(200) preview(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.rotation.recommendations(id, req.user, body); }
}
@Module({ imports: [IdentityModule, FarmModule, NasaModule], controllers: [RotationController], providers: [RotationService] })
export class RotationModule {}
