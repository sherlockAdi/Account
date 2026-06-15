import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { permissionCatalog } from './permission-catalog';

const DEFAULT_TENANT = {
  name: 'Default Company',
  slug: 'default',
};

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults() {
    const tenant = await this.prisma.tenant.upsert({
      where: { slug: DEFAULT_TENANT.slug },
      update: {},
      create: DEFAULT_TENANT,
    });

    await Promise.all(
      permissionCatalog.map((permission) =>
        this.prisma.permission.upsert({
          where: { code: permission.code },
          update: permission,
          create: permission,
        }),
      ),
    );

    const allPermissions = await this.prisma.permission.findMany();
    const adminRole = await this.prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: 'admin' } },
      update: { name: 'Admin', isSystem: true },
      create: {
        tenantId: tenant.id,
        name: 'Admin',
        code: 'admin',
        description: 'Full access to all modules.',
        isSystem: true,
      },
    });

    await this.prisma.rolePermission.createMany({
      data: allPermissions.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })),
      skipDuplicates: true,
    });

    return tenant;
  }

  async listPermissions() {
    await this.ensureDefaults();
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  }

  async listRoles() {
    const tenant = await this.ensureDefaults();
    return this.prisma.role.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(dto: CreateRoleDto) {
    const tenant = await this.ensureDefaults();
    const permissions = await this.findPermissionsByCode(dto.permissionCodes ?? []);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          isSystem: dto.isSystem ?? false,
        },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  async setRolePermissions(roleId: string, dto: SetRolePermissionsDto) {
    const permissions = await this.findPermissionsByCode(dto.permissionCodes);
    const role = await this.prisma.role.findFirst({ where: { id: roleId, deletedAt: null } });
    if (!role) throw new NotFoundException('Role not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
        skipDuplicates: true,
      });

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  async updateRole(roleId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, deletedAt: null } });
    if (!role) throw new NotFoundException('Role not found');

    const permissions = dto.permissionCodes ? await this.findPermissionsByCode(dto.permissionCodes) : null;

    return this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: roleId },
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          isSystem: dto.isSystem,
        },
      });

      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  async listUsers() {
    const tenant = await this.ensureDefaults();
    return this.prisma.user.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        createdAt: true,
        roles: { include: { role: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async createUser(dto: CreateUserDto) {
    const tenant = await this.ensureDefaults();
    const roles = await this.findRolesByCode(tenant.id, dto.roleCodes ?? []);
    const passwordHash = await hash(dto.password, 12);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          passwordHash,
        },
      });

      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
          skipDuplicates: true,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          roles: { include: { role: true } },
        },
      });
    });
  }

  async setUserRoles(userId: string, dto: SetUserRolesDto) {
    const tenant = await this.ensureDefaults();
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId: tenant.id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const roles = await this.findRolesByCode(tenant.id, dto.roleCodes);
    return this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id })),
        skipDuplicates: true,
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          roles: { include: { role: true } },
        },
      });
    });
  }

  async updateUser(userId: string, dto: UpdateUserDto) {
    const tenant = await this.ensureDefaults();
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId: tenant.id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const roles = dto.roleCodes ? await this.findRolesByCode(tenant.id, dto.roleCodes) : null;
    const passwordHash = dto.password ? await hash(dto.password, 12) : undefined;

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: dto.email?.toLowerCase(),
          fullName: dto.fullName,
          passwordHash,
        },
      });

      if (roles) {
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId, roleId: role.id })),
          skipDuplicates: true,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          roles: { include: { role: true } },
        },
      });
    });
  }

  async getEffectivePermissions(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const permissions = new Map<string, unknown>();
    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.set(rolePermission.permission.code, rolePermission.permission);
      }
    }

    return {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((userRole) => userRole.role.code),
      permissions: [...permissions.values()],
    };
  }

  private async findPermissionsByCode(codes: string[]) {
    if (codes.length === 0) return [];
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: codes } } });
    if (permissions.length !== codes.length) {
      const found = new Set(permissions.map((permission) => permission.code));
      throw new BadRequestException({ message: 'Unknown permission codes', missing: codes.filter((code) => !found.has(code)) });
    }
    return permissions;
  }

  private async findRolesByCode(tenantId: string, codes: string[]) {
    if (codes.length === 0) return [];
    const roles = await this.prisma.role.findMany({ where: { tenantId, code: { in: codes }, deletedAt: null } });
    if (roles.length !== codes.length) {
      const found = new Set(roles.map((role) => role.code));
      throw new BadRequestException({ message: 'Unknown role codes', missing: codes.filter((code) => !found.has(code)) });
    }
    return roles;
  }
}
