import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { AccountingQueryDto } from './dto/accounting-query.dto';
import { CreateAccountGroupDto } from './dto/create-account-group.dto';
import { CreateBudgetGrantDto } from './dto/create-budget-grant.dto';
import { CreateBudgetTypeDto } from './dto/create-budget-type.dto';
import { CreateLedgerDto } from './dto/create-ledger.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { CreateVoucherTypeDto } from './dto/create-voucher-type.dto';
import { UpdateAccountGroupDto } from './dto/update-account-group.dto';
import { UpdateLedgerDto } from './dto/update-ledger.dto';
import { UpdateVoucherBudgetDto } from './dto/update-voucher-budget.dto';
import { UpdateVoucherTypeDto } from './dto/update-voucher-type.dto';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listGroups(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.accountGroup.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { parent: true, ledgers: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
      orderBy: [{ nature: 'asc' }, { name: 'asc' }],
    });
  }

  async createGroup(companyId: string | undefined, dto: CreateAccountGroupDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.accountGroup.create({ data: { companyId: company.id, ...dto } });
  }

  async updateGroup(id: string, dto: UpdateAccountGroupDto) {
    await this.findGroup(id);
    return this.prisma.accountGroup.update({ where: { id }, data: dto });
  }

  async listLedgers(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.ledger.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { group: true },
      orderBy: { name: 'asc' },
    });
  }

  async listVoucherTypes(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.voucherType.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async listBudgets(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    await this.ensureDefaultBudget(company.id);

    const budgets = await this.prisma.budgetType.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        grants: {
          where: { deletedAt: null },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ isAnnual: 'desc' }, { name: 'asc' }],
    });

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        companyId: company.id,
        deletedAt: null,
        budgetTypeId: { not: null },
      },
      include: {
        lines: true,
      },
    });

    return budgets.map((budget) => {
      const budgetVouchers = vouchers.filter((voucher) => voucher.budgetTypeId === budget.id);
      const utilizedAmount = budgetVouchers.reduce((sum, voucher) => {
        return sum + voucher.lines.filter((line) => line.type === DebitCredit.DEBIT).reduce((lineSum, line) => lineSum + Number(line.amount), 0);
      }, 0);
      const grants = budget.grants.map((grant) => {
        const grantVouchers = budgetVouchers.filter((voucher) => voucher.budgetGrantId === grant.id);
        const grantUtilized = grantVouchers.reduce((sum, voucher) => {
          return sum + voucher.lines.filter((line) => line.type === DebitCredit.DEBIT).reduce((lineSum, line) => lineSum + Number(line.amount), 0);
        }, 0);
        return {
          ...grant,
          amount: Number(grant.amount),
          utilizedAmount: Number(grantUtilized.toFixed(2)),
          availableAmount: Number((Number(grant.amount) - grantUtilized).toFixed(2)),
        };
      });

      return {
        ...budget,
        totalAmount: Number(budget.totalAmount),
        utilizedAmount: Number(utilizedAmount.toFixed(2)),
        availableAmount: Number((Number(budget.totalAmount) - utilizedAmount).toFixed(2)),
        grants,
      };
    });
  }

  async createBudget(companyId: string | undefined, dto: CreateBudgetTypeDto) {
    const company = await this.resolveCompany(companyId);
    const budget = await this.prisma.budgetType.create({
      data: {
        companyId: company.id,
        name: dto.name,
        code: dto.code,
        category: dto.category ?? 'ANNUAL',
        totalAmount: new Prisma.Decimal(dto.totalAmount ?? 0),
        isAnnual: dto.isAnnual ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    if (budget.isAnnual) {
      await this.prisma.budgetType.updateMany({
        where: { companyId: company.id, id: { not: budget.id }, isAnnual: true, deletedAt: null },
        data: { isAnnual: false },
      });
    }

    return budget;
  }

  async createBudgetGrant(companyId: string | undefined, budgetTypeId: string, dto: CreateBudgetGrantDto) {
    const company = await this.resolveCompany(companyId);
    const budget = await this.findBudgetType(budgetTypeId, company.id);
    return this.prisma.budgetGrant.create({
      data: {
        companyId: company.id,
        budgetTypeId: budget.id,
        name: dto.name,
        code: dto.code,
        amount: new Prisma.Decimal(dto.amount ?? 0),
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async createVoucherType(companyId: string | undefined, dto: CreateVoucherTypeDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.voucherType.create({
      data: {
        companyId: company.id,
        name: dto.name,
        code: dto.code,
        category: dto.category,
        prefix: dto.prefix,
        nextNumber: dto.nextNumber ?? 1,
        padding: dto.padding ?? 5,
        suffix: dto.suffix,
        isSystem: dto.isSystem ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateVoucherType(id: string, dto: UpdateVoucherTypeDto) {
    await this.findVoucherType(id);
    return this.prisma.voucherType.update({ where: { id }, data: dto });
  }

  async createLedger(companyId: string | undefined, dto: CreateLedgerDto) {
    const company = await this.resolveCompany(companyId);
    await this.findGroup(dto.groupId);
    return this.prisma.ledger.create({
      data: {
        companyId: company.id,
        ...dto,
        ledgerType: dto.ledgerType ?? 'GENERAL',
        openingBalance: new Prisma.Decimal(dto.openingBalance ?? 0),
        openingType: dto.openingType ?? DebitCredit.DEBIT,
      },
      include: { group: true },
    });
  }

  async updateLedger(id: string, dto: UpdateLedgerDto) {
    await this.findLedger(id);
    return this.prisma.ledger.update({
      where: { id },
      data: {
        ...dto,
        openingBalance: dto.openingBalance === undefined ? undefined : new Prisma.Decimal(dto.openingBalance),
      },
      include: { group: true },
    });
  }

  async listVouchers(query: AccountingQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    return this.prisma.voucher.findMany({
      where: { companyId: company.id, deletedAt: null, voucherDate: this.dateFilter(query) },
      include: {
        branch: true,
        budgetType: true,
        budgetGrant: true,
        lines: { include: { ledger: true } },
      },
      orderBy: [{ voucherDate: 'desc' }, { voucherNo: 'desc' }],
    });
  }

  async createVoucher(companyId: string | undefined, dto: CreateVoucherDto) {
    const company = await this.resolveCompany(companyId);
    const voucherIdentity = await this.resolveVoucherIdentity(company.id, dto);
    const budgetSelection = await this.resolveBudgetSelection(company.id, dto);
    const debit = dto.lines.filter((line) => line.type === DebitCredit.DEBIT).reduce((sum, line) => sum + Number(line.amount), 0);
    const credit = dto.lines.filter((line) => line.type === DebitCredit.CREDIT).reduce((sum, line) => sum + Number(line.amount), 0);

    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      throw new BadRequestException(`Voucher is not balanced. Debit ${debit.toFixed(2)} must equal credit ${credit.toFixed(2)}.`);
    }

    const ledgers = await this.prisma.ledger.findMany({
      where: { id: { in: dto.lines.map((line) => line.ledgerId) }, companyId: company.id, deletedAt: null },
    });
    if (ledgers.length !== new Set(dto.lines.map((line) => line.ledgerId)).size) {
      throw new BadRequestException('One or more ledgers are invalid for this company');
    }

    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          branchId: dto.branchId,
          budgetTypeId: budgetSelection.budgetTypeId,
          budgetGrantId: budgetSelection.budgetGrantId,
          voucherType: voucherIdentity.voucherType,
          voucherNo: voucherIdentity.voucherNo,
          voucherDate: new Date(dto.voucherDate),
          narration: dto.narration,
          lines: {
            create: dto.lines.map((line) => ({
              ledgerId: line.ledgerId,
              type: line.type,
              amount: new Prisma.Decimal(line.amount),
              narration: line.narration,
            })),
          },
        },
        include: {
          branch: true,
          budgetType: true,
          budgetGrant: true,
          lines: { include: { ledger: true } },
        },
      });

      if (voucherIdentity.voucherTypeId && voucherIdentity.usedAutoNumber) {
        await tx.voucherType.update({
          where: { id: voucherIdentity.voucherTypeId },
          data: { nextNumber: { increment: 1 } },
        });
      }

      return voucher;
    });
  }

  async updateVoucherBudget(companyId: string | undefined, id: string, dto: UpdateVoucherBudgetDto) {
    const company = await this.resolveCompany(companyId);
    const voucher = await this.prisma.voucher.findFirst({ where: { id, companyId: company.id, deletedAt: null } });
    if (!voucher) throw new NotFoundException('Voucher not found');

    const budgetSelection = await this.resolveBudgetSelection(company.id, dto);

    return this.prisma.voucher.update({
      where: { id },
      data: {
        budgetTypeId: budgetSelection.budgetTypeId,
        budgetGrantId: budgetSelection.budgetGrantId,
      },
      include: {
        branch: true,
        budgetType: true,
        budgetGrant: true,
        lines: { include: { ledger: true } },
      },
    });
  }

  async trialBalance(query: AccountingQueryDto) {
    const ledgers = await this.listLedgers(query.companyId);
    const company = await this.resolveCompany(query.companyId);
    const lines = await this.prisma.voucherLine.findMany({
      where: { voucher: { companyId: company.id, deletedAt: null, voucherDate: this.dateFilter(query) } },
      include: { ledger: { include: { group: true } } },
    });

    return ledgers.map((ledger) => {
      const opening = Number(ledger.openingBalance) * (ledger.openingType === DebitCredit.DEBIT ? 1 : -1);
      const movement = lines
        .filter((line) => line.ledgerId === ledger.id)
        .reduce((sum, line) => sum + Number(line.amount) * (line.type === DebitCredit.DEBIT ? 1 : -1), opening);
      return {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        groupName: ledger.group.name,
        debit: movement >= 0 ? Number(movement.toFixed(2)) : 0,
        credit: movement < 0 ? Number(Math.abs(movement).toFixed(2)) : 0,
      };
    });
  }

  async ledgerReport(ledgerId: string, query: AccountingQueryDto) {
    const ledger = await this.findLedger(ledgerId);
    const lines = await this.prisma.voucherLine.findMany({
      where: { ledgerId, voucher: { deletedAt: null, voucherDate: this.dateFilter(query) } },
      include: { voucher: true },
      orderBy: { voucher: { voucherDate: 'asc' } },
    });

    let balance = Number(ledger.openingBalance) * (ledger.openingType === DebitCredit.DEBIT ? 1 : -1);
    return {
      ledger,
      openingBalance: balance,
      entries: lines.map((line) => {
        balance += Number(line.amount) * (line.type === DebitCredit.DEBIT ? 1 : -1);
        return {
          date: line.voucher.voucherDate,
          voucherType: line.voucher.voucherType,
          voucherNo: line.voucher.voucherNo,
          narration: line.narration || line.voucher.narration,
          debit: line.type === DebitCredit.DEBIT ? Number(line.amount) : 0,
          credit: line.type === DebitCredit.CREDIT ? Number(line.amount) : 0,
          balance: Number(balance.toFixed(2)),
        };
      }),
      closingBalance: Number(balance.toFixed(2)),
    };
  }

  async dayBook(query: AccountingQueryDto) {
    return this.listVouchers(query);
  }

  private dateFilter(query: AccountingQueryDto) {
    if (!query.from && !query.to) return undefined;
    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(query.to) : undefined,
    };
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.prisma.company.findFirst({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!company) throw new BadRequestException('Create a company before using accounting');
    return company;
  }

  private async findGroup(id: string) {
    const group = await this.prisma.accountGroup.findFirst({ where: { id, deletedAt: null } });
    if (!group) throw new NotFoundException('Account group not found');
    return group;
  }

  private async findLedger(id: string) {
    const ledger = await this.prisma.ledger.findFirst({ where: { id, deletedAt: null }, include: { group: true } });
    if (!ledger) throw new NotFoundException('Ledger not found');
    return ledger;
  }

  private async findVoucherType(id: string) {
    const voucherType = await this.prisma.voucherType.findFirst({ where: { id, deletedAt: null } });
    if (!voucherType) throw new NotFoundException('Voucher type not found');
    return voucherType;
  }

  private async findBudgetType(id: string, companyId: string) {
    const budgetType = await this.prisma.budgetType.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!budgetType) throw new NotFoundException('Budget not found');
    return budgetType;
  }

  private async findBudgetGrant(id: string, companyId: string, budgetTypeId?: string) {
    const budgetGrant = await this.prisma.budgetGrant.findFirst({
      where: { id, companyId, deletedAt: null, ...(budgetTypeId ? { budgetTypeId } : {}) },
    });
    if (!budgetGrant) throw new NotFoundException('Budget grant not found');
    return budgetGrant;
  }

  private async ensureDefaultBudget(companyId: string) {
    const annualBudget = await this.prisma.budgetType.findFirst({
      where: { companyId, deletedAt: null, isAnnual: true },
      orderBy: { createdAt: 'asc' },
    });

    if (annualBudget) {
      return annualBudget;
    }

    return this.prisma.budgetType.create({
      data: {
        companyId,
        name: 'Annual Budget',
        code: 'ANNUAL',
        category: 'ANNUAL',
        totalAmount: new Prisma.Decimal(0),
        isAnnual: true,
        isActive: true,
      },
    });
  }

  private async resolveBudgetSelection(companyId: string, dto: { budgetTypeId?: string | null; budgetGrantId?: string | null }) {
    let budgetType: { id: string; budgetTypeId?: string } | null = null;

    if (dto.budgetTypeId) {
      budgetType = await this.findBudgetType(dto.budgetTypeId, companyId);
    } else if (dto.budgetGrantId) {
      const grant = await this.findBudgetGrant(dto.budgetGrantId, companyId);
      budgetType = await this.findBudgetType(grant.budgetTypeId, companyId);
    } else {
      budgetType = await this.ensureDefaultBudget(companyId);
    }

    if (!dto.budgetGrantId) {
      return { budgetTypeId: budgetType.id, budgetGrantId: null };
    }

    const budgetGrant = await this.findBudgetGrant(dto.budgetGrantId, companyId, budgetType.id);
    return { budgetTypeId: budgetType.id, budgetGrantId: budgetGrant.id };
  }

  private async resolveVoucherIdentity(companyId: string, dto: CreateVoucherDto) {
    if (dto.voucherTypeId) {
      const voucherType = await this.prisma.voucherType.findFirst({ where: { id: dto.voucherTypeId, companyId, deletedAt: null, isActive: true } });
      if (!voucherType) throw new NotFoundException('Voucher type not found');
      const autoNo = `${voucherType.prefix}${String(voucherType.nextNumber).padStart(voucherType.padding, '0')}${voucherType.suffix ?? ''}`;
      return {
        voucherTypeId: voucherType.id,
        voucherType: voucherType.code,
        voucherNo: dto.voucherNo || autoNo,
        usedAutoNumber: !dto.voucherNo,
      };
    }

    if (!dto.voucherType || !dto.voucherNo) {
      throw new BadRequestException('voucherTypeId is required, or provide both voucherType and voucherNo');
    }

    return {
      voucherType: dto.voucherType,
      voucherNo: dto.voucherNo,
      usedAutoNumber: false,
    };
  }
}
