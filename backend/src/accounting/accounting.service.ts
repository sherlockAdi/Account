import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetFlow, DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { TallySyncService } from '../tally-sync/tally-sync.service';
import { AccountingQueryDto } from './dto/accounting-query.dto';
import { CreateAccountGroupDto } from './dto/create-account-group.dto';
import { CreateBudgetGrantDto } from './dto/create-budget-grant.dto';
import { CreateBudgetTypeDto } from './dto/create-budget-type.dto';
import { CreateLedgerDto } from './dto/create-ledger.dto';
import { CreateLedgerTypeMasterDto } from './dto/create-ledger-type-master.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { CreateVoucherTypeDto } from './dto/create-voucher-type.dto';
import { UpdateAccountGroupDto } from './dto/update-account-group.dto';
import { UpdateLedgerDto } from './dto/update-ledger.dto';
import { UpdateLedgerTypeMasterDto } from './dto/update-ledger-type-master.dto';
import { UpdateVoucherBudgetDto } from './dto/update-voucher-budget.dto';
import { UpdateVoucherTypeDto } from './dto/update-voucher-type.dto';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
    private readonly tallySyncService: TallySyncService,
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

  async listLedgerTypes(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    await this.ensureDefaultLedgerTypes(company.id);
    return this.prisma.ledgerTypeMaster.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
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
        costCenter: true,
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
      const receivedAmount = this.sumBudgetVouchers(budgetVouchers, BudgetFlow.RECEIPT);
      const utilizedAmount = this.sumBudgetVouchers(budgetVouchers, BudgetFlow.UTILIZATION);
      const availableBase = receivedAmount > 0 ? receivedAmount : Number(budget.totalAmount);
      const grants = budget.grants.map((grant) => {
        const grantVouchers = budgetVouchers.filter((voucher) => voucher.budgetGrantId === grant.id);
        const grantReceived = this.sumBudgetVouchers(grantVouchers, BudgetFlow.RECEIPT);
        const grantUtilized = this.sumBudgetVouchers(grantVouchers, BudgetFlow.UTILIZATION);
        const grantAvailableBase = grantReceived > 0 ? grantReceived : Number(grant.amount);
        return {
          ...grant,
          amount: Number(grant.amount),
          receivedAmount: Number(grantReceived.toFixed(2)),
          utilizedAmount: Number(grantUtilized.toFixed(2)),
          availableAmount: Number((grantAvailableBase - grantUtilized).toFixed(2)),
        };
      });

      return {
        ...budget,
        totalAmount: Number(budget.totalAmount),
        receivedAmount: Number(receivedAmount.toFixed(2)),
        utilizedAmount: Number(utilizedAmount.toFixed(2)),
        availableAmount: Number((availableBase - utilizedAmount).toFixed(2)),
        grants,
      };
    });
  }

  async createBudget(companyId: string | undefined, dto: CreateBudgetTypeDto) {
    const company = await this.resolveCompany(companyId);
    const budget = await this.prisma.budgetType.create({
      data: {
        companyId: company.id,
        costCenterId: dto.costCenterId || null,
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

    if (dto.initialGrant?.name && dto.initialGrant?.code) {
      const grant = await this.prisma.budgetGrant.create({
        data: {
          companyId: company.id,
          budgetTypeId: budget.id,
          name: dto.initialGrant.name,
          code: dto.initialGrant.code,
          amount: new Prisma.Decimal(dto.initialGrant.amount ?? 0),
          isDefault: dto.initialGrant.isDefault ?? true,
          isActive: dto.initialGrant.isActive ?? true,
        },
      });

      if (grant.isDefault) {
        await this.prisma.budgetGrant.updateMany({
          where: { companyId: company.id, budgetTypeId: budget.id, id: { not: grant.id }, deletedAt: null },
          data: { isDefault: false },
        });
      }
    }

    return this.prisma.budgetType.findFirstOrThrow({
      where: { id: budget.id },
      include: {
        costCenter: true,
        grants: {
          where: { deletedAt: null },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        },
      },
    });
  }

  async createBudgetGrant(companyId: string | undefined, budgetTypeId: string, dto: CreateBudgetGrantDto) {
    return this.createBudgetGrantRecord(companyId, budgetTypeId, dto);
  }

  async createBudgetGrantOptional(companyId: string | undefined, dto: CreateBudgetGrantDto) {
    return this.createBudgetGrantRecord(companyId, dto.budgetTypeId, dto);
  }

  private async createBudgetGrantRecord(companyId: string | undefined, budgetTypeId: string | undefined, dto: CreateBudgetGrantDto) {
    const company = await this.resolveCompany(companyId);
    const budget = budgetTypeId ? await this.findBudgetType(budgetTypeId, company.id) : await this.ensureDefaultBudget(company.id);
    const grant = await this.prisma.budgetGrant.create({
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
    if (grant.isDefault) {
      await this.prisma.budgetGrant.updateMany({
        where: { companyId: company.id, budgetTypeId: budget.id, id: { not: grant.id }, deletedAt: null },
        data: { isDefault: false },
      });
    }
    return grant;
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

  async createLedgerType(companyId: string | undefined, dto: CreateLedgerTypeMasterDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.ledgerTypeMaster.create({
      data: {
        companyId: company.id,
        name: dto.name,
        code: dto.code.toUpperCase(),
        notes: dto.notes,
        isActive: dto.isActive ?? true,
        isSystem: false,
      },
    });
  }

  async updateLedgerType(id: string, dto: UpdateLedgerTypeMasterDto) {
    await this.findLedgerType(id);
    return this.prisma.ledgerTypeMaster.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code === undefined ? undefined : dto.code.toUpperCase(),
      },
    });
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

  async getVoucher(id: string, companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.voucher.findFirstOrThrow({
      where: { id, companyId: company.id, deletedAt: null },
      include: {
        branch: true,
        budgetType: {
          include: {
            costCenter: true,
          },
        },
        budgetGrant: true,
        lines: { include: { ledger: true } },
      },
    });
  }

  async createVoucher(companyId: string | undefined, dto: CreateVoucherDto) {
    const company = await this.resolveCompany(companyId);
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

    const voucher = await this.prisma.$transaction(async (tx) => {
      const voucherIdentity = await this.reserveVoucherIdentity(tx, company.id, dto);
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          branchId: dto.branchId,
          budgetTypeId: budgetSelection.budgetTypeId,
          budgetGrantId: budgetSelection.budgetGrantId,
          budgetFlow: budgetSelection.budgetFlow,
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
      return voucher;
    });

    void this.tallySyncService.exportVoucherToTally(voucher.id, company.id).catch((error) => {
      // Voucher creation must succeed even if Tally is offline; sync will retry on the next batch.
      console.warn(`Unable to export voucher ${voucher.voucherNo} to Tally:`, error instanceof Error ? error.message : error);
    });

    return voucher;
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
        budgetFlow: budgetSelection.budgetFlow,
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

  private async ensureDefaultLedgerTypes(companyId: string) {
    for (const type of [
      { name: 'General', code: 'GENERAL' },
      { name: 'Cash', code: 'CASH' },
      { name: 'Bank', code: 'BANK' },
      { name: 'Capital', code: 'CAPITAL' },
      { name: 'Customer', code: 'CUSTOMER' },
      { name: 'Vendor', code: 'VENDOR' },
      { name: 'Tax', code: 'TAX' },
      { name: 'Expense', code: 'EXPENSE' },
      { name: 'Income', code: 'INCOME' },
    ] as const) {
      await this.prisma.ledgerTypeMaster.upsert({
        where: { companyId_code: { companyId, code: type.code } },
        update: { name: type.name, isSystem: true },
        create: { companyId, ...type, isSystem: true },
      });
    }
  }

  private async findLedgerType(id: string) {
    const ledgerType = await this.prisma.ledgerTypeMaster.findFirst({ where: { id, deletedAt: null } });
    if (!ledgerType) throw new NotFoundException('Ledger type not found');
    return ledgerType;
  }

  private async resolveBudgetSelection(companyId: string, dto: { budgetTypeId?: string | null; budgetGrantId?: string | null; budgetFlow?: BudgetFlow | null }) {
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
      return {
        budgetTypeId: budgetType.id,
        budgetGrantId: null,
        budgetFlow: dto.budgetFlow ?? BudgetFlow.UTILIZATION,
      };
    }

    const budgetGrant = await this.findBudgetGrant(dto.budgetGrantId, companyId, budgetType.id);
    return {
      budgetTypeId: budgetType.id,
      budgetGrantId: budgetGrant.id,
      budgetFlow: dto.budgetFlow ?? BudgetFlow.UTILIZATION,
    };
  }

  private sumBudgetVouchers(vouchers: Array<{ budgetFlow: BudgetFlow; lines: Array<{ type: DebitCredit; amount: Prisma.Decimal }> }>, flow: BudgetFlow) {
    return vouchers
      .filter((voucher) => voucher.budgetFlow === flow)
      .reduce((sum, voucher) => {
        return sum + voucher.lines.filter((line) => line.type === DebitCredit.DEBIT).reduce((lineSum, line) => lineSum + Number(line.amount), 0);
      }, 0);
  }

  private async reserveVoucherIdentity(tx: Prisma.TransactionClient, companyId: string, dto: CreateVoucherDto) {
    if (dto.voucherTypeId) {
      const [voucherType] = await tx.$queryRaw<Array<{
        voucherTypeId: string;
        voucherType: string;
        prefix: string;
        padding: number;
        suffix: string | null;
        reservedNumber: number;
      }>>`
        UPDATE voucher_types
        SET next_number = next_number + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${dto.voucherTypeId}
          AND company_id = ${companyId}
          AND deleted_at IS NULL
          AND is_active = true
        RETURNING id AS "voucherTypeId",
                  code AS "voucherType",
                  prefix,
                  padding,
                  suffix,
                  next_number - 1 AS "reservedNumber"
      `;
      if (!voucherType) throw new NotFoundException('Voucher type not found');
      const autoNo = `${voucherType.prefix}${String(voucherType.reservedNumber).padStart(voucherType.padding, '0')}${voucherType.suffix ?? ''}`;
      return {
        voucherTypeId: voucherType.voucherTypeId,
        voucherType: voucherType.voucherType,
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
