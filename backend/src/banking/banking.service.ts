import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateChequeDto, UpdateChequeStatusDto } from './dto/create-cheque.dto';
import { CreatePaymentAdviceDto } from './dto/create-payment-advice.dto';
import { ReconcileTransactionDto } from './dto/reconcile-transaction.dto';

@Injectable()
export class BankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async accounts(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    const ledgers = await this.prisma.ledger.findMany({
      where: { companyId: company.id, ledgerType: { in: ['BANK', 'CASH'] }, isActive: true, deletedAt: null },
      include: {
        voucherLines: {
          where: { voucher: { deletedAt: null, status: 'POSTED' } },
        },
      },
      orderBy: [{ ledgerType: 'asc' }, { name: 'asc' }],
    });
    return ledgers.map((ledger) => {
      const opening = Number(ledger.openingBalance) * (ledger.openingType === DebitCredit.DEBIT ? 1 : -1);
      const balance = ledger.voucherLines.reduce(
        (sum, line) => sum + Number(line.amount) * (line.type === DebitCredit.DEBIT ? 1 : -1),
        opening,
      );
      return {
        id: ledger.id,
        name: ledger.name,
        code: ledger.code,
        ledgerType: ledger.ledgerType,
        bankName: ledger.bankName,
        bankAccountNo: ledger.bankAccountNo,
        bankIfsc: ledger.bankIfsc,
        bankBranch: ledger.bankBranch,
        balance: this.money(balance),
      };
    });
  }

  async transactions(companyId?: string, bankLedgerId?: string) {
    const company = await this.resolveCompany(companyId);
    const bankLedgers = await this.prisma.ledger.findMany({
      where: {
        companyId: company.id,
        ledgerType: 'BANK',
        deletedAt: null,
        ...(bankLedgerId ? { id: bankLedgerId } : {}),
      },
    });
    const ledgerIds = bankLedgers.map((ledger) => ledger.id);
    if (bankLedgerId && !ledgerIds.length) throw new NotFoundException('Bank account not found');
    const lines = await this.prisma.voucherLine.findMany({
      where: {
        ledgerId: { in: ledgerIds },
        voucher: { companyId: company.id, deletedAt: null, status: 'POSTED' },
      },
      include: {
        ledger: true,
        voucher: {
          include: {
            lines: { include: { ledger: true } },
          },
        },
        bankReconciliation: true,
      },
      orderBy: [{ voucher: { voucherDate: 'desc' } }, { createdAt: 'desc' }],
    });
    return lines.map((line) => {
      const counterparties = line.voucher.lines
        .filter((voucherLine) => voucherLine.id !== line.id)
        .map((voucherLine) => voucherLine.ledger.name)
        .join(', ');
      return {
        voucherLineId: line.id,
        bankLedgerId: line.ledgerId,
        bankLedgerName: line.ledger.name,
        date: line.voucher.voucherDate,
        voucherNo: line.voucher.voucherNo,
        voucherType: line.voucher.voucherType,
        narration: line.narration || line.voucher.narration,
        counterparty: counterparties,
        deposit: line.type === DebitCredit.DEBIT ? Number(line.amount) : 0,
        withdrawal: line.type === DebitCredit.CREDIT ? Number(line.amount) : 0,
        reconciliation: line.bankReconciliation,
      };
    });
  }

  async reconcile(voucherLineId: string, dto: ReconcileTransactionDto) {
    const line = await this.prisma.voucherLine.findFirst({
      where: { id: voucherLineId, ledger: { ledgerType: 'BANK', deletedAt: null } },
      include: { ledger: true, voucher: true },
    });
    if (!line) throw new NotFoundException('Bank transaction not found');
    const clearedDate = new Date(dto.clearedDate);
    if (clearedDate < line.voucher.voucherDate) {
      throw new BadRequestException('Cleared date cannot be before the voucher date');
    }
    return this.prisma.bankReconciliation.upsert({
      where: { voucherLineId },
      update: { clearedDate, bankReference: dto.bankReference, notes: dto.notes, status: 'RECONCILED' },
      create: {
        companyId: line.ledger.companyId,
        bankLedgerId: line.ledgerId,
        voucherLineId,
        clearedDate,
        bankReference: dto.bankReference,
        notes: dto.notes,
        status: 'RECONCILED',
      },
    });
  }

  async cheques(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.cheque.findMany({
      where: { companyId: company.id },
      include: { bankLedger: true, partyLedger: true, voucher: true },
      orderBy: [{ chequeDate: 'desc' }, { chequeNo: 'desc' }],
    });
  }

  async createCheque(companyId: string | undefined, dto: CreateChequeDto) {
    const company = await this.resolveCompany(companyId);
    await this.validateLedgers(company.id, dto.bankLedgerId, dto.partyLedgerId);
    return this.prisma.cheque.create({
      data: {
        companyId: company.id,
        bankLedgerId: dto.bankLedgerId,
        partyLedgerId: dto.partyLedgerId,
        chequeNo: dto.chequeNo,
        chequeDate: new Date(dto.chequeDate),
        amount: new Prisma.Decimal(dto.amount),
        direction: dto.direction,
        payeeName: dto.payeeName,
        notes: dto.notes,
      },
      include: { bankLedger: true, partyLedger: true },
    });
  }

  async updateChequeStatus(id: string, dto: UpdateChequeStatusDto) {
    const cheque = await this.prisma.cheque.findUnique({ where: { id } });
    if (!cheque) throw new NotFoundException('Cheque not found');
    if (dto.status === 'CLEARED' && !dto.clearedDate) {
      throw new BadRequestException('Cleared date is required when clearing a cheque');
    }
    return this.prisma.cheque.update({
      where: { id },
      data: {
        status: dto.status,
        clearedDate: dto.clearedDate ? new Date(dto.clearedDate) : dto.status === 'CLEARED' ? cheque.clearedDate : null,
      },
      include: { bankLedger: true, partyLedger: true },
    });
  }

  async paymentAdvices(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.paymentAdvice.findMany({
      where: { companyId: company.id },
      include: { bankLedger: true, beneficiaryLedger: true, voucher: true },
      orderBy: [{ adviceDate: 'desc' }, { adviceNo: 'desc' }],
    });
  }

  async createPaymentAdvice(companyId: string | undefined, dto: CreatePaymentAdviceDto) {
    const company = await this.resolveCompany(companyId);
    const { bank, party } = await this.validateLedgers(company.id, dto.bankLedgerId, dto.beneficiaryLedgerId);
    if (!party) throw new BadRequestException('Beneficiary ledger is required');
    if (bank.id === party.id) throw new BadRequestException('Bank and beneficiary ledgers must be different');
    const paymentDate = new Date(dto.paymentDate);

    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          voucherType: 'payment',
          voucherNo: dto.adviceNo,
          voucherDate: paymentDate,
          narration: dto.narration || `Payment advice ${dto.adviceNo} to ${party.name}`,
          lines: {
            create: [
              {
                ledgerId: party.id,
                type: DebitCredit.DEBIT,
                amount: new Prisma.Decimal(dto.amount),
                narration: dto.narration,
              },
              {
                ledgerId: bank.id,
                type: DebitCredit.CREDIT,
                amount: new Prisma.Decimal(dto.amount),
                narration: dto.bankReference || dto.paymentMode,
              },
            ],
          },
        },
      });
      return tx.paymentAdvice.create({
        data: {
          companyId: company.id,
          bankLedgerId: bank.id,
          beneficiaryLedgerId: party.id,
          voucherId: voucher.id,
          adviceNo: dto.adviceNo,
          adviceDate: new Date(dto.adviceDate),
          paymentDate,
          amount: new Prisma.Decimal(dto.amount),
          paymentMode: dto.paymentMode,
          bankReference: dto.bankReference,
          status: 'ISSUED',
          narration: dto.narration,
        },
        include: { bankLedger: true, beneficiaryLedger: true, voucher: true },
      });
    });
  }

  async dashboard(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    // Keep remote database connection usage bounded while the page loads its other banking endpoints.
    const accounts = await this.accounts(company.id);
    const transactions = await this.transactions(company.id);
    const [cheques, advices] = await Promise.all([
      this.prisma.cheque.findMany({ where: { companyId: company.id } }),
      this.prisma.paymentAdvice.findMany({ where: { companyId: company.id }, orderBy: { adviceDate: 'desc' }, take: 5 }),
    ]);
    const bankAccounts = accounts.filter((account) => account.ledgerType === 'BANK');
    const cashAccounts = accounts.filter((account) => account.ledgerType === 'CASH');
    return {
      totalBankBalance: this.money(bankAccounts.reduce((sum, account) => sum + account.balance, 0)),
      totalCashBalance: this.money(cashAccounts.reduce((sum, account) => sum + account.balance, 0)),
      unreconciledCount: transactions.filter((transaction) => !transaction.reconciliation).length,
      unreconciledAmount: this.money(
        transactions
          .filter((transaction) => !transaction.reconciliation)
          .reduce((sum, transaction) => sum + transaction.deposit - transaction.withdrawal, 0),
      ),
      pendingCheques: cheques.filter((cheque) => ['PENDING', 'DEPOSITED'].includes(cheque.status)).length,
      pendingChequeAmount: this.money(
        cheques
          .filter((cheque) => ['PENDING', 'DEPOSITED'].includes(cheque.status))
          .reduce((sum, cheque) => sum + Number(cheque.amount), 0),
      ),
      accounts,
      recentAdvices: advices,
    };
  }

  private async validateLedgers(companyId: string, bankLedgerId: string, partyLedgerId?: string) {
    const ids = [bankLedgerId, ...(partyLedgerId ? [partyLedgerId] : [])];
    const ledgers = await this.prisma.ledger.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null, isActive: true },
    });
    const bank = ledgers.find((ledger) => ledger.id === bankLedgerId);
    const party = partyLedgerId ? ledgers.find((ledger) => ledger.id === partyLedgerId) : undefined;
    if (!bank || bank.ledgerType !== 'BANK') throw new BadRequestException('Selected bank ledger is invalid');
    if (partyLedgerId && !party) throw new BadRequestException('Selected party ledger is invalid');
    return { bank, party };
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
    if (!company) throw new BadRequestException('Create a company before using banking');
    return company;
  }
}
