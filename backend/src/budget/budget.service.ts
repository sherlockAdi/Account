import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetStatus, DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetStatusDto } from './dto/update-budget-status.dto';

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async dashboard(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    const budgets = await this.budgetRows(company.id);
    const active = budgets.filter((budget) => budget.status === BudgetStatus.ACTIVE);
    const source = active.length ? active : budgets;
    const allocated = source.reduce((sum, budget) => sum + Number(budget.totalAmount), 0);
    const actual = source.reduce((sum, budget) => sum + budget.actualAmount, 0);

    return {
      company: { id: company.id, name: company.name },
      budgetCount: budgets.length,
      activeCount: active.length,
      allocatedAmount: this.money(allocated),
      actualAmount: this.money(actual),
      remainingAmount: this.money(allocated - actual),
      utilizationPercent: allocated ? this.money((actual / allocated) * 100) : 0,
      budgets: budgets.slice(0, 5),
    };
  }

  async budgets(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.budgetRows(company.id);
  }

  async ledgers(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.ledger.findMany({
      where: { companyId: company.id, deletedAt: null, group: { nature: { in: ['INCOME', 'EXPENSE'] } } },
      include: { group: true },
      orderBy: [{ group: { nature: 'asc' } }, { name: 'asc' }],
    });
  }

  async branches(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.branch.findMany({
      where: { companyId: company.id, deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createBudget(companyId: string | undefined, dto: CreateBudgetDto) {
    const company = await this.resolveCompany(companyId);
    if (!dto.lines.length) throw new BadRequestException('Add at least one budget line');

    const periodFrom = new Date(dto.periodFrom);
    const periodTo = new Date(`${dto.periodTo}T23:59:59.999Z`);
    if (periodFrom > periodTo) throw new BadRequestException('Budget period start must be before period end');

    const ledgerIds = [...new Set(dto.lines.map((line) => line.ledgerId))];
    const ledgers = await this.prisma.ledger.findMany({ where: { id: { in: ledgerIds }, companyId: company.id, deletedAt: null } });
    if (ledgers.length !== ledgerIds.length) throw new BadRequestException('One or more ledgers are invalid for this company');

    const branchIds = [...new Set(dto.lines.map((line) => line.branchId).filter(Boolean))] as string[];
    if (branchIds.length) {
      const branches = await this.prisma.branch.findMany({ where: { id: { in: branchIds }, companyId: company.id, deletedAt: null } });
      if (branches.length !== branchIds.length) throw new BadRequestException('One or more branches are invalid for this company');
    }

    const totalAmount = dto.lines.reduce((sum, line) => sum + Number(line.allocatedAmount), 0);
    const budget = await this.prisma.budgetPlan.create({
      data: {
        companyId: company.id,
        name: dto.name,
        code: dto.code.toUpperCase(),
        fiscalYear: dto.fiscalYear,
        periodFrom,
        periodTo,
        status: dto.status ?? BudgetStatus.DRAFT,
        totalAmount,
        notes: dto.notes,
        lines: {
          create: dto.lines.map((line) => ({
            ledgerId: line.ledgerId,
            branchId: line.branchId || undefined,
            allocatedAmount: Number(line.allocatedAmount),
            notes: line.notes,
          })),
        },
      },
      include: this.budgetInclude(),
    });

    return this.withActuals(budget);
  }

  async updateStatus(id: string, dto: UpdateBudgetStatusDto) {
    const existing = await this.prisma.budgetPlan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Budget not found');

    const budget = await this.prisma.budgetPlan.update({
      where: { id },
      data: { status: dto.status },
      include: this.budgetInclude(),
    });
    return this.withActuals(budget);
  }

  private async budgetRows(companyId: string) {
    const budgets = await this.prisma.budgetPlan.findMany({
      where: { companyId, deletedAt: null },
      include: this.budgetInclude(),
      orderBy: [{ periodFrom: 'desc' }, { code: 'asc' }],
    });
    return Promise.all(budgets.map((budget) => this.withActuals(budget)));
  }

  private async withActuals(budget: Prisma.BudgetPlanGetPayload<{ include: ReturnType<BudgetService['budgetInclude']> }>) {
    const lines = await Promise.all(budget.lines.map(async (line) => {
      const actualAmount = await this.actualForLine(budget, line);
      const allocatedAmount = Number(line.allocatedAmount);
      return {
        ...line,
        allocatedAmount: this.money(allocatedAmount),
        actualAmount: this.money(actualAmount),
        remainingAmount: this.money(allocatedAmount - actualAmount),
        utilizationPercent: allocatedAmount ? this.money((actualAmount / allocatedAmount) * 100) : 0,
      };
    }));
    const actualAmount = lines.reduce((sum, line) => sum + line.actualAmount, 0);
    const totalAmount = Number(budget.totalAmount);

    return {
      ...budget,
      totalAmount: this.money(totalAmount),
      actualAmount: this.money(actualAmount),
      remainingAmount: this.money(totalAmount - actualAmount),
      utilizationPercent: totalAmount ? this.money((actualAmount / totalAmount) * 100) : 0,
      lines,
    };
  }

  private async actualForLine(
    budget: Prisma.BudgetPlanGetPayload<{ include: ReturnType<BudgetService['budgetInclude']> }>,
    line: Prisma.BudgetLineGetPayload<{ include: { ledger: { include: { group: true } }; branch: true } }>,
  ) {
    const voucherLines = await this.prisma.voucherLine.findMany({
      where: {
        ledgerId: line.ledgerId,
        voucher: {
          companyId: budget.companyId,
          branchId: line.branchId || undefined,
          deletedAt: null,
          status: 'POSTED',
          voucherDate: { gte: budget.periodFrom, lte: budget.periodTo },
        },
      },
      select: { amount: true, type: true },
    });
    return voucherLines.reduce((sum, voucherLine) => {
      const signed = Number(voucherLine.amount) * (voucherLine.type === DebitCredit.DEBIT ? 1 : -1);
      return sum + (line.ledger.group.nature === 'INCOME' ? -signed : signed);
    }, 0);
  }

  private budgetInclude() {
    return {
      company: true,
      lines: {
        include: { ledger: { include: { group: true } }, branch: true },
        orderBy: [{ ledger: { name: 'asc' } }],
      },
    } satisfies Prisma.BudgetPlanInclude;
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.prisma.company.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!company) throw new BadRequestException('Create a company before using budgets');
    return company;
  }
}
