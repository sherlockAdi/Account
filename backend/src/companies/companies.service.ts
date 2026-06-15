import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateVoucherSeriesDto } from './dto/create-voucher-series.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateVoucherSeriesDto } from './dto/update-voucher-series.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listCompanies() {
    const tenant = await this.identityService.ensureDefaults();
    return this.prisma.company.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: {
        branches: {
          where: { deletedAt: null },
          include: { warehouses: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
          orderBy: { name: 'asc' },
        },
        voucherSeries: { where: { deletedAt: null }, orderBy: { module: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCompany(dto: CreateCompanyDto) {
    const tenant = await this.identityService.ensureDefaults();
    return this.prisma.company.create({
      data: {
        tenantId: tenant.id,
        ...dto,
        financialYearStart: new Date(dto.financialYearStart),
        booksStartDate: new Date(dto.booksStartDate),
      },
      include: { branches: true, voucherSeries: true },
    });
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    await this.findCompany(id);
    return this.prisma.company.update({
      where: { id },
      data: this.companyData(dto),
      include: {
        branches: { where: { deletedAt: null }, include: { warehouses: { where: { deletedAt: null } } } },
        voucherSeries: { where: { deletedAt: null } },
      },
    });
  }

  async listBranches(companyId: string) {
    await this.findCompany(companyId);
    return this.prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      include: { warehouses: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createBranch(companyId: string, dto: CreateBranchDto) {
    await this.findCompany(companyId);
    if (dto.isPrimary) await this.prisma.branch.updateMany({ where: { companyId }, data: { isPrimary: false } });
    return this.prisma.branch.create({
      data: { companyId, ...dto },
      include: { warehouses: true },
    });
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const branch = await this.findBranch(id);
    if (dto.isPrimary) await this.prisma.branch.updateMany({ where: { companyId: branch.companyId }, data: { isPrimary: false } });
    return this.prisma.branch.update({
      where: { id },
      data: dto,
      include: { warehouses: { where: { deletedAt: null } } },
    });
  }

  async listWarehouses(branchId: string) {
    await this.findBranch(branchId);
    return this.prisma.warehouse.findMany({
      where: { branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createWarehouse(branchId: string, dto: CreateWarehouseDto) {
    await this.findBranch(branchId);
    if (dto.isPrimary) await this.prisma.warehouse.updateMany({ where: { branchId }, data: { isPrimary: false } });
    return this.prisma.warehouse.create({ data: { branchId, ...dto } });
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.findWarehouse(id);
    if (dto.isPrimary) await this.prisma.warehouse.updateMany({ where: { branchId: warehouse.branchId }, data: { isPrimary: false } });
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async listVoucherSeries(companyId: string) {
    await this.findCompany(companyId);
    return this.prisma.voucherSeries.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ module: 'asc' }, { prefix: 'asc' }],
    });
  }

  async createVoucherSeries(companyId: string, dto: CreateVoucherSeriesDto) {
    await this.findCompany(companyId);
    return this.prisma.voucherSeries.create({ data: { companyId, ...dto } });
  }

  async updateVoucherSeries(id: string, dto: UpdateVoucherSeriesDto) {
    await this.findVoucherSeries(id);
    return this.prisma.voucherSeries.update({ where: { id }, data: dto });
  }

  private companyData(dto: CreateCompanyDto | UpdateCompanyDto) {
    return {
      ...dto,
      financialYearStart: dto.financialYearStart ? new Date(dto.financialYearStart) : undefined,
      booksStartDate: dto.booksStartDate ? new Date(dto.booksStartDate) : undefined,
    };
  }

  private async findCompany(id: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async findBranch(id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, deletedAt: null } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  private async findWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, deletedAt: null } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  private async findVoucherSeries(id: string) {
    const voucherSeries = await this.prisma.voucherSeries.findFirst({ where: { id, deletedAt: null } });
    if (!voucherSeries) throw new NotFoundException('Voucher series not found');
    return voucherSeries;
  }
}
