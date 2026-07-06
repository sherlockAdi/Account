import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdentityService } from '../identity/identity.service';
import { PrismaService } from '../database/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listCostCenters(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.costCenter.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  async createCostCenter(companyId: string | undefined, dto: CreateCostCenterDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.costCenter.create({
      data: {
        companyId: company.id,
        name: dto.name,
        code: dto.code,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCostCenter(id: string, dto: UpdateCostCenterDto) {
    await this.findCostCenter(id);
    return this.prisma.costCenter.update({ where: { id }, data: dto });
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new BadRequestException('Company not found');
      return company;
    }
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.prisma.company.findFirst({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!company) throw new BadRequestException('Create a company before using cost centres');
    return company;
  }

  private async findCostCenter(id: string) {
    const costCenter = await this.prisma.costCenter.findFirst({ where: { id, deletedAt: null } });
    if (!costCenter) throw new NotFoundException('Cost centre not found');
    return costCenter;
  }
}
