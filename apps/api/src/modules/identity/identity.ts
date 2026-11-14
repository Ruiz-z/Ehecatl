import { Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, Injectable, Module, Post, SetMetadata, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface Actor { id: string; email: string; name: string; role: 'FARMER' | 'ADMIN' }
export interface AuthRequest { headers: Record<string, string | string[] | undefined>; user: Actor }
export const Roles = (...roles: Actor['role'][]) => SetMetadata('roles', roles);

@Injectable()
export class IdentityService {
  private readonly dummyHash = bcrypt.hash('invalid-credential-placeholder', 12);
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(body: unknown) {
    const input = body as Record<string, unknown> | null;
    if (!input || typeof input.email !== 'string' || typeof input.password !== 'string' || input.password.length > 72 || Buffer.byteLength(input.password) > 72) throw new UnauthorizedException('Credenciales inválidas');
    const user = await this.prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? await this.dummyHash);
    if (!user || !valid) throw new UnauthorizedException('Credenciales inválidas');
    const actor: Actor = { id: user.id, email: user.email, name: user.name, role: user.role };
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), tokenType: 'Bearer', expiresIn: 3600, user: actor };
  }

  async authenticate(token: string): Promise<Actor> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string') throw new Error('Invalid subject');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, name: true, role: true } });
      if (!user) throw new Error('Unknown user');
      return user;
    } catch { throw new UnauthorizedException('Sesión inválida o expirada'); }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly identity: IdentityService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer \S+$/i.test(header)) throw new UnauthorizedException('Sesión requerida');
    req.user = await this.identity.authenticate(header.slice(7));
    const roles = this.reflector.getAllAndOverride<Actor['role'][]>('roles', [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('Acceso denegado');
    return true;
  }
}

@Controller('auth')
class IdentityController {
  constructor(private readonly identity: IdentityService) {}
  @Post('login') @HttpCode(200)
  login(@Body() body: unknown) { return this.identity.login(body); }
}

@Module({ imports: [JwtModule.registerAsync({ useFactory: () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
  return { secret, signOptions: { expiresIn: 3600, algorithm: 'HS256' as const } };
} })], controllers: [IdentityController], providers: [IdentityService, AuthGuard], exports: [IdentityService, AuthGuard] })
export class IdentityModule {}
