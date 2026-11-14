import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IdentityModule, AuthGuard, type AuthRequest } from '../identity/identity.js';
import { FarmService } from './farm.service.js';

@Controller() @UseGuards(AuthGuard)
export class FarmController {
  constructor(private readonly farm: FarmService) {}
  @Get('parcels') list(@Req() req: AuthRequest) { return this.farm.list(req.user); }
  @Post('parcels') create(@Req() req: AuthRequest, @Body() body: unknown) { return this.farm.createParcel(body, req.user); }
  @Get('parcels/:id') parcel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.farm.parcel(id, req.user); }
  @Patch('parcels/:id') update(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.farm.updateParcel(id, body, req.user); }
  @Delete('parcels/:id') @HttpCode(204) remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.farm.deleteParcel(id, req.user); }
  @Get('parcels/:id/zones') async zones(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return (await this.farm.parcel(id, req.user)).zones; }
  @Post('parcels/:id/zones') addZone(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.farm.createZone(id, body, req.user); }
  @Get('zones/:id') zone(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.farm.zone(id, req.user); }
  @Patch('zones/:id') updateZone(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.farm.updateZone(id, body, req.user); }
  @Delete('zones/:id') @HttpCode(204) removeZone(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return this.farm.deleteZone(id, req.user); }
  @Get('zones/:id/history') async history(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) { return (await this.farm.zone(id, req.user)).history; }
  @Post('zones/:id/history') addHistory(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.farm.addHistory(id, body, req.user); }
  @Patch('zones/:id/history/:historyId') updateHistory(@Param('id', ParseUUIDPipe) id: string, @Param('historyId', ParseUUIDPipe) historyId: string, @Req() req: AuthRequest, @Body() body: unknown) { return this.farm.updateHistory(id, historyId, body, req.user); }
  @Delete('zones/:id/history/:historyId') @HttpCode(204) removeHistory(@Param('id', ParseUUIDPipe) id: string, @Param('historyId', ParseUUIDPipe) historyId: string, @Req() req: AuthRequest) { return this.farm.deleteHistory(id, historyId, req.user); }
  @Get('me/priorities') priorities(@Req() req: AuthRequest) { return this.farm.priorities(req.user.id); }
  @Put('me/priorities') setPriorities(@Req() req: AuthRequest, @Body() body: unknown) { return this.farm.setPriorities(req.user.id, body); }
}

@Module({ imports: [IdentityModule], controllers: [FarmController], providers: [FarmService], exports: [FarmService] })
export class FarmModule {}
