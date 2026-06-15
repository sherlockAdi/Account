import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditOutcome, Prisma, VoucherVerificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { VerifyVoucherDto } from './dto/verify-voucher.dto';

export type RecordAuditInput = {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  description: string;
  method?: string;
  path?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome?: AuditOutcome;
  statusCode?: number;
  changes?: unknown;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async record(input: RecordAuditInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          ...input,
          changes: input.changes as Prisma.InputJsonValue | undefined,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      return null;
    }
  }

  async logs(query: AuditQueryDto) {
    const company = query.companyId ? await this.resolveCompany(query.companyId) : null;
    return this.prisma.auditLog.findMany({
      where: {
        companyId: company?.id,
        module: query.module,
        action: query.action,
        outcome: query.outcome as AuditOutcome | undefined,
        userId: query.userId,
        createdAt: this.dateFilter(query),
      },
      include: { user: { select: { id: true, fullName: true, email: true } }, company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async dashboard(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, failures, mutations, verifications, recent] = await Promise.all([
      this.prisma.auditLog.count({ where: { companyId: company.id } }),
      this.prisma.auditLog.count({ where: { companyId: company.id, outcome: 'FAILURE', createdAt: { gte: since } } }),
      this.prisma.auditLog.count({ where: { companyId: company.id, action: { in: ['CREATE', 'UPDATE', 'DELETE', 'PROCESS', 'VERIFY'] }, createdAt: { gte: since } } }),
      this.prisma.voucherVerification.groupBy({ by: ['status'], where: { voucher: { companyId: company.id, deletedAt: null } }, _count: true }),
      this.prisma.auditLog.findMany({
        where: { companyId: company.id },
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const voucherCount = await this.prisma.voucher.count({ where: { companyId: company.id, deletedAt: null } });
    const verified = verifications.find((row) => row.status === 'VERIFIED')?._count ?? 0;
    const rejected = verifications.find((row) => row.status === 'REJECTED')?._count ?? 0;
    return {
      totalEvents: total,
      failures24h: failures,
      mutations24h: mutations,
      voucherVerification: { total: voucherCount, verified, rejected, unverified: Math.max(0, voucherCount - verified - rejected) },
      recent,
    };
  }

  async voucherVerifications(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.voucher.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        branch: true,
        lines: { include: { ledger: true } },
        verification: { include: { verifiedBy: { select: { fullName: true, email: true } } } },
      },
      orderBy: [{ voucherDate: 'desc' }, { voucherNo: 'desc' }],
    });
  }

  async verifyVoucher(voucherId: string, dto: VerifyVoucherDto, userId?: string) {
    const voucher = await this.prisma.voucher.findFirst({
      where: { id: voucherId, deletedAt: null },
      include: { lines: true },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    const debit = voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0);
    const credit = voucher.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount), 0);
    if (dto.status === VoucherVerificationStatus.VERIFIED && Math.round(debit * 100) !== Math.round(credit * 100)) {
      throw new BadRequestException('An unbalanced voucher cannot be verified');
    }
    return this.prisma.voucherVerification.upsert({
      where: { voucherId },
      update: {
        status: dto.status,
        remarks: dto.remarks,
        verifiedById: userId,
        verifiedAt: dto.status === 'UNVERIFIED' ? null : new Date(),
      },
      create: {
        voucherId,
        status: dto.status,
        remarks: dto.remarks,
        verifiedById: userId,
        verifiedAt: dto.status === 'UNVERIFIED' ? null : new Date(),
      },
      include: { verifiedBy: { select: { fullName: true, email: true } }, voucher: true },
    });
  }

  async securitySummary(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [{ companyId: company.id }, { tenantId: company.tenantId, module: 'auth' }],
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
    const uniqueIps = new Set(logs.map((log) => log.ipAddress).filter(Boolean));
    return {
      periodDays: 7,
      loginSuccesses: logs.filter((log) => log.module === 'auth' && log.action === 'LOGIN' && log.outcome === 'SUCCESS').length,
      loginFailures: logs.filter((log) => log.module === 'auth' && log.action === 'LOGIN' && log.outcome === 'FAILURE').length,
      failedOperations: logs.filter((log) => log.module !== 'auth' && log.outcome === 'FAILURE').length,
      uniqueIpCount: uniqueIps.size,
      recentSecurityEvents: logs.filter((log) => log.module === 'auth' || log.outcome === 'FAILURE').slice(0, 50),
    };
  }

  private dateFilter(query: AuditQueryDto) {
    if (!query.from && !query.to) return undefined;
    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
    };
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
    if (!company) throw new BadRequestException('Create a company before using audit');
    return company;
  }
}
