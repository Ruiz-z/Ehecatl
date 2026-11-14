import { Controller, Get, Module, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { IdentityModule, AuthGuard, type AuthRequest } from '../identity/identity.js';
import { FarmModule } from '../farm-context/farm.controller.js';
import { FarmService } from '../farm-context/farm.service.js';
import { NasaService } from './nasa.service.js';

@Controller('zones') @UseGuards(AuthGuard)
class NasaController {
  constructor(private readonly farm: FarmService, private readonly nasa: NasaService) {}
  @Get(':id/indicators')
  async get(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Query('start') start?: string, @Query('end') end?: string) {
    const zone = await this.farm.zone(id, req.user);
    return this.nasa.get(zone.lat ?? zone.parcel.lat, zone.lon ?? zone.parcel.lon, zone.irrigated, start, end);
  }
}
@Module({ imports: [IdentityModule, FarmModule], controllers: [NasaController], providers: [NasaService], exports: [NasaService] })
export class NasaModule {}
