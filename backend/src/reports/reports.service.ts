import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountNature, DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

type StatementRow = {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  nature: AccountNature;
  amount: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async profitLoss(query: ReportsQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const rows = await this.statementRows(company.id, query, false);
    const income = rows.filter((row) => row.nature === 'INCOME' && row.amount !== 0);
    const expenses = rows.filter((row) => row.nature === 'EXPENSE' && row.amount !== 0);
    const totalIncome = this.money(income.reduce((sum, row) => sum + Math.abs(row.amount), 0));
    const totalExpenses = this.money(expenses.reduce((sum, row) => sum + Math.abs(row.amount), 0));
    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      income: income.map((row) => ({ ...row, amount: this.money(Math.abs(row.amount)) })),
      expenses: expenses.map((row) => ({ ...row, amount: this.money(Math.abs(row.amount)) })),
      totalIncome,
      totalExpenses,
      netProfit: this.money(totalIncome - totalExpenses),
    };
  }

  async balanceSheet(query: ReportsQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const asOfQuery = { ...query, from: undefined };
    const rows = await this.statementRows(company.id, asOfQuery, true);
    const profitLoss = await this.profitLoss({ companyId: company.id, to: query.to });
    const assets = rows.filter((row) => row.nature === 'ASSET' && row.amount !== 0);
    const liabilities = rows.filter((row) => row.nature === 'LIABILITY' && row.amount !== 0);
    const equity = rows.filter((row) => row.nature === 'EQUITY' && row.amount !== 0);
    const totalAssets = this.money(assets.reduce((sum, row) => sum + row.amount, 0));
    const totalLiabilities = this.money(liabilities.reduce((sum, row) => sum - row.amount, 0));
    const baseEquity = this.money(equity.reduce((sum, row) => sum - row.amount, 0));
    const totalEquity = this.money(baseEquity + profitLoss.netProfit);
    return {
      asOf: query.to ?? null,
      assets: assets.map((row) => ({ ...row, amount: this.money(row.amount) })),
      liabilities: liabilities.map((row) => ({ ...row, amount: this.money(-row.amount) })),
      equity: equity.map((row) => ({ ...row, amount: this.money(-row.amount) })),
      currentPeriodProfit: profitLoss.netProfit,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: this.money(totalLiabilities + totalEquity),
      difference: this.money(totalAssets - totalLiabilities - totalEquity),
    };
  }

  async dashboard(query: ReportsQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const dateFilter = this.dateFilter(query);
    const [sales, salesReturns, purchases, purchaseReturns] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: { companyId: company.id, deletedAt: null, status: 'POSTED', invoiceDate: dateFilter },
        _sum: { subtotal: true, taxAmount: true, totalAmount: true },
        _count: true,
      }),
      this.prisma.salesReturn.aggregate({
        where: { companyId: company.id, deletedAt: null, status: 'POSTED', returnDate: dateFilter },
        _sum: { subtotal: true, taxAmount: true, totalAmount: true },
        _count: true,
      }),
      this.prisma.purchaseInvoice.aggregate({
        where: { companyId: company.id, deletedAt: null, status: 'POSTED', invoiceDate: dateFilter },
        _sum: { subtotal: true, taxAmount: true, totalAmount: true },
        _count: true,
      }),
      this.prisma.purchaseReturn.aggregate({
        where: { companyId: company.id, deletedAt: null, status: 'POSTED', returnDate: dateFilter },
        _sum: { subtotal: true, taxAmount: true, totalAmount: true },
        _count: true,
      }),
    ]);

    const [stockMovements, outstanding, payroll, bankLines] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { item: { companyId: company.id, deletedAt: null } },
        select: { type: true, amount: true },
      }),
      this.prisma.ledger.findMany({
        where: { companyId: company.id, ledgerType: { in: ['CUSTOMER', 'VENDOR'] }, deletedAt: null },
        include: { voucherLines: { where: { voucher: { deletedAt: null, status: 'POSTED' } } } },
      }),
      this.prisma.payrollRun.aggregate({
        where: { companyId: company.id, status: 'PROCESSED', paymentDate: dateFilter },
        _sum: { totalGross: true, totalDeductions: true, totalNet: true },
        _count: true,
      }),
      this.prisma.ledger.findMany({
        where: { companyId: company.id, ledgerType: { in: ['BANK', 'CASH'] }, deletedAt: null },
        include: { voucherLines: { where: { voucher: { deletedAt: null, status: 'POSTED' } } } },
      }),
    ]);

    const positiveStock = new Set(['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'PRODUCTION_IN']);
    const stockValue = stockMovements.reduce(
      (sum, movement) => sum + Number(movement.amount) * (positiveStock.has(movement.type) ? 1 : -1),
      0,
    );
    const ledgerBalance = (ledger: typeof outstanding[number] | typeof bankLines[number]) => {
      const opening = Number(ledger.openingBalance) * (ledger.openingType === DebitCredit.DEBIT ? 1 : -1);
      return ledger.voucherLines.reduce(
        (sum, line) => sum + Number(line.amount) * (line.type === DebitCredit.DEBIT ? 1 : -1),
        opening,
      );
    };
    const receivables = outstanding.filter((ledger) => ledger.ledgerType === 'CUSTOMER').reduce((sum, ledger) => sum + Math.max(0, ledgerBalance(ledger)), 0);
    const payables = outstanding.filter((ledger) => ledger.ledgerType === 'VENDOR').reduce((sum, ledger) => sum + Math.max(0, -ledgerBalance(ledger)), 0);
    const bankBalance = bankLines.filter((ledger) => ledger.ledgerType === 'BANK').reduce((sum, ledger) => sum + ledgerBalance(ledger), 0);
    const cashBalance = bankLines.filter((ledger) => ledger.ledgerType === 'CASH').reduce((sum, ledger) => sum + ledgerBalance(ledger), 0);
    const netSales = Number(sales._sum.totalAmount ?? 0) - Number(salesReturns._sum.totalAmount ?? 0);
    const netPurchases = Number(purchases._sum.totalAmount ?? 0) - Number(purchaseReturns._sum.totalAmount ?? 0);
    const profitLoss = await this.profitLoss({ ...query, companyId: company.id });

    return {
      company: { id: company.id, name: company.name },
      period: { from: query.from ?? null, to: query.to ?? null },
      sales: {
        invoiceCount: sales._count,
        returnCount: salesReturns._count,
        taxableValue: this.money(Number(sales._sum.subtotal ?? 0) - Number(salesReturns._sum.subtotal ?? 0)),
        taxAmount: this.money(Number(sales._sum.taxAmount ?? 0) - Number(salesReturns._sum.taxAmount ?? 0)),
        total: this.money(netSales),
      },
      purchases: {
        invoiceCount: purchases._count,
        returnCount: purchaseReturns._count,
        taxableValue: this.money(Number(purchases._sum.subtotal ?? 0) - Number(purchaseReturns._sum.subtotal ?? 0)),
        taxAmount: this.money(Number(purchases._sum.taxAmount ?? 0) - Number(purchaseReturns._sum.taxAmount ?? 0)),
        total: this.money(netPurchases),
      },
      stockValue: this.money(stockValue),
      receivables: this.money(receivables),
      payables: this.money(payables),
      bankBalance: this.money(bankBalance),
      cashBalance: this.money(cashBalance),
      payroll: {
        runCount: payroll._count,
        gross: this.money(Number(payroll._sum.totalGross ?? 0)),
        deductions: this.money(Number(payroll._sum.totalDeductions ?? 0)),
        net: this.money(Number(payroll._sum.totalNet ?? 0)),
      },
      netProfit: profitLoss.netProfit,
      gst: {
        outputTax: this.money(Number(sales._sum.taxAmount ?? 0) - Number(salesReturns._sum.taxAmount ?? 0)),
        inputTax: this.money(Number(purchases._sum.taxAmount ?? 0) - Number(purchaseReturns._sum.taxAmount ?? 0)),
        netPayable: this.money(
          Number(sales._sum.taxAmount ?? 0) -
          Number(salesReturns._sum.taxAmount ?? 0) -
          Number(purchases._sum.taxAmount ?? 0) +
          Number(purchaseReturns._sum.taxAmount ?? 0),
        ),
      },
    };
  }

  private async statementRows(companyId: string, query: ReportsQueryDto, includeOpening: boolean) {
    const ledgers = await this.prisma.ledger.findMany({
      where: { companyId, deletedAt: null },
      include: {
        group: true,
        voucherLines: {
          where: { voucher: { deletedAt: null, status: 'POSTED', voucherDate: this.dateFilter(query) } },
        },
      },
      orderBy: [{ group: { nature: 'asc' } }, { name: 'asc' }],
    });
    return ledgers.map((ledger): StatementRow => {
      const opening = includeOpening
        ? Number(ledger.openingBalance) * (ledger.openingType === DebitCredit.DEBIT ? 1 : -1)
        : 0;
      const amount = ledger.voucherLines.reduce(
        (sum, line) => sum + Number(line.amount) * (line.type === DebitCredit.DEBIT ? 1 : -1),
        opening,
      );
      return {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        groupName: ledger.group.name,
        nature: ledger.group.nature,
        amount: this.money(amount),
      };
    });
  }

  private dateFilter(query: ReportsQueryDto) {
    if (!query.from && !query.to) return undefined;
    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
    };
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
    if (!company) throw new BadRequestException('Create a company before using reports');
    return company;
  }
}
