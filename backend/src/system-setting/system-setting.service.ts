import { Injectable } from '@nestjs/common';
import { Prisma, SystemSetting } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { UpdateSystemModulesDto } from './dto/update-system-modules.dto';

const MODULES_KEY = 'enabledModules';

export type SystemModules = {
  budget: boolean;
  grant: boolean;
  payroll: boolean;
  sales: boolean;
  purchase: boolean;
  costCenter: boolean;
};

const DEFAULT_MODULES: SystemModules = {
  budget: true,
  grant: true,
  payroll: true,
  sales: true,
  purchase: true,
  costCenter: true,
};

function isModuleSettings(
  value: Prisma.JsonValue | null | undefined,
): value is Partial<SystemModules> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

@Injectable()
export class SystemSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async getModules() {
    const tenant = await this.identityService.ensureDefaults();
    const record = await this.prisma.systemSetting.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: MODULES_KEY } },
    });

    const value = this.normalize(record?.value);
    if (!record) {
      return this.persistModules(tenant.id, value);
    }

    return this.toResponse(record, value);
  }

  async updateModules(dto: UpdateSystemModulesDto) {
    const tenant = await this.identityService.ensureDefaults();
    return this.persistModules(tenant.id, dto);
  }

  private async persistModules(tenantId: string, value: SystemModules) {
    const record = await this.prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key: MODULES_KEY } },
      update: { value },
      create: {
        tenantId,
        key: MODULES_KEY,
        value,
      },
    });

    return this.toResponse(record, value);
  }

  private toResponse(record: SystemSetting, value: SystemModules) {
    return {
      key: record.key,
      modules: value,
      updatedAt: record.updatedAt,
    };
  }

  private normalize(value: Prisma.JsonValue | null | undefined): SystemModules {
    const source = isModuleSettings(value) ? value : {};
    return {
      budget: Boolean(source.budget ?? DEFAULT_MODULES.budget),
      grant: Boolean(source.grant ?? DEFAULT_MODULES.grant),
      payroll: Boolean(source.payroll ?? DEFAULT_MODULES.payroll),
      sales: Boolean(source.sales ?? DEFAULT_MODULES.sales),
      purchase: Boolean(source.purchase ?? DEFAULT_MODULES.purchase),
      costCenter: Boolean(source.costCenter ?? DEFAULT_MODULES.costCenter),
    };
  }
}
