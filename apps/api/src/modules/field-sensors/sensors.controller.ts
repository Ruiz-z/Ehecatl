import { Body, Controller, Get, Headers, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, IdentityModule, Roles, type AuthRequest } from '../identity/identity.js';
import { FarmModule } from '../farm-context/farm.controller.js';
import { SensorsService } from './sensors.service.js';

@Controller() @UseGuards(AuthGuard)
class SensorsController {
  constructor(private readonly sensors: SensorsService) {}
  @Post('devices') @Roles('ADMIN') create(@Body() body: unknown, @Req() req: AuthRequest) { return this.sensors.create(body, req.user); }
  @Get('zones/:id/devices') devices(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.sensors.list(id, req.user); }
  @Patch('devices/:id') @Roles('ADMIN') update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: AuthRequest) { return this.sensors.update(id, body, req.user); }
  @Post('devices/:id/rotate-key') @HttpCode(200) @Roles('ADMIN') rotate(@Param('id', ParseUUIDPipe) id: string) { return this.sensors.rotate(id); }
  @Post('devices/:id/revoke') @HttpCode(200) @Roles('ADMIN') revoke(@Param('id', ParseUUIDPipe) id: string) { return this.sensors.revoke(id); }
  @Get('zones/:id/readings') readings(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest,
    @Query() query: { from?: string; to?: string; limit?: string; cursor?: string }) { return this.sensors.readings(id, req.user, query); }
}

@Controller()
class DeviceIngestController {
  constructor(private readonly sensors: SensorsService) {}
  @Get('device') self(@Headers('x-device-key') key: unknown) { return this.sensors.self(key); }
  @Post('readings') @HttpCode(200) reading(@Headers('x-device-key') key: unknown, @Body() body: unknown,
    @Req() req: { rawBody?: Buffer }) { return this.sensors.ingest(key, body, req.rawBody?.length); }
}

@Module({ imports: [IdentityModule, FarmModule], controllers: [SensorsController, DeviceIngestController], providers: [SensorsService] })
export class SensorsModule {}
