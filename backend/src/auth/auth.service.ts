import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly identityService: IdentityService,
  ) {}

  async login(dto: LoginDto) {
    await this.identityService.ensureDefaults();

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null, status: 'ACTIVE' },
      include: { tenant: true, roles: { include: { role: true } } },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const effective = await this.identityService.getEffectivePermissions(user.id);
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: user.roles.map((userRole) => userRole.role.code),
    });

    return {
      accessToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        roles: user.roles.map((userRole) => ({ code: userRole.role.code, name: userRole.role.name })),
        permissions: effective.permissions,
      },
    };
  }

  async me(authHeader?: string) {
    const token = this.extractBearerToken(authHeader);
    const payload = await this.jwtService.verifyAsync(token);
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: 'ACTIVE' },
      include: { tenant: true, roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('User session is no longer valid');

    const effective = await this.identityService.getEffectivePermissions(user.id);
    return {
      id: user.id,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      roles: user.roles.map((userRole) => ({ code: userRole.role.code, name: userRole.role.name })),
      permissions: effective.permissions,
    };
  }

  private extractBearerToken(authHeader?: string) {
    const [type, token] = authHeader?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');
    return token;
  }
}
