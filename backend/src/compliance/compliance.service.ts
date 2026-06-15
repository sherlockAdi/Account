import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateComplianceRuleDto, UpdateComplianceRuleDto, UpdateComplianceRuleStatusDto } from './dto/create-compliance-rule.dto';
import { CreateObligationDto, UpdateObligationStatusDto } from './dto/create-obligation.dto';

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService, private readonly identity: IdentityService) {}

  async dashboard(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    await this.refreshOverdue(company.id);
    const today = new Date();
    const nextMonth = new Date(today.getTime() + 30 * 86400000);
    const [rules, obligations, itemTaxPeriods, salaryStructures] = await Promise.all([
      this.prisma.complianceRule.findMany({ where: { tenantId: company.tenantId, OR: [{ companyId: null }, { companyId: company.id }] }, orderBy: { effectiveFrom: 'desc' } }),
      this.prisma.complianceObligation.findMany({ where: { companyId: company.id }, orderBy: { dueDate: 'asc' } }),
      this.prisma.itemTaxRate.count({ where: { item: { companyId: company.id, deletedAt: null } } }),
      this.prisma.salaryStructure.count({ where: { employee: { companyId: company.id, deletedAt: null }, isActive: true } }),
    ]);
    const active = rules.filter((rule) => rule.status === 'ACTIVE' && rule.effectiveFrom <= today && (!rule.effectiveTo || rule.effectiveTo >= today));
    return {
      activeRules: active.length,
      draftRules: rules.filter((rule) => rule.status === 'DRAFT').length,
      upcomingObligations: obligations.filter((item) => item.dueDate >= today && item.dueDate <= nextMonth && item.status !== 'FILED').length,
      overdueObligations: obligations.filter((item) => item.status === 'OVERDUE').length,
      itemTaxPeriods,
      salaryStructures,
      nextObligations: obligations.filter((item) => item.status !== 'FILED').slice(0, 5),
      recentRules: rules.slice(0, 5),
    };
  }

  async rules(query: { companyId?: string; type?: string; status?: string; onDate?: string }) {
    const company = await this.resolveCompany(query.companyId);
    const onDate = query.onDate ? new Date(query.onDate) : null;
    return this.prisma.complianceRule.findMany({
      where: {
        tenantId: company.tenantId,
        OR: [{ companyId: null }, { companyId: company.id }],
        ...(query.type ? { type: query.type as never } : {}),
        ...(query.status ? { status: query.status as never } : {}),
        ...(onDate ? { effectiveFrom: { lte: onDate }, AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }] }] } : {}),
      },
      include: { company: { select: { id: true, name: true, code: true } } },
      orderBy: [{ type: 'asc' }, { code: 'asc' }, { version: 'desc' }],
    });
  }

  async createRule(dto: CreateComplianceRuleDto) {
    const company = await this.resolveCompany(dto.companyId);
    const period = this.period(dto.effectiveFrom, dto.effectiveTo);
    const code = dto.code.toUpperCase();
    await this.noOverlap(company.tenantId, code, dto.country || 'India', dto.state || null, period);
    const latest = await this.prisma.complianceRule.findFirst({
      where: { tenantId: company.tenantId, code, country: dto.country || 'India', state: dto.state || null },
      orderBy: { version: 'desc' },
    });
    return this.prisma.complianceRule.create({
      data: {
        tenantId: company.tenantId, companyId: dto.companyId, name: dto.name, code, type: dto.type,
        country: dto.country || 'India', state: dto.state || null, version: (latest?.version || 0) + 1,
        ...period, description: dto.description, configuration: dto.configuration as Prisma.InputJsonValue,
        sourceUrl: dto.sourceUrl, notes: dto.notes,
      },
      include: { company: true },
    });
  }

  async updateRule(id: string, dto: UpdateComplianceRuleDto) {
    const rule = await this.requireRule(id);
    if (rule.status === 'ACTIVE') throw new BadRequestException('Archive the active rule before editing it');
    const company = await this.resolveCompany(dto.companyId || rule.companyId || undefined);
    const period = this.period(dto.effectiveFrom, dto.effectiveTo);
    const code = dto.code.toUpperCase();
    await this.noOverlap(company.tenantId, code, dto.country || 'India', dto.state || null, period, id);
    return this.prisma.complianceRule.update({
      where: { id },
      data: {
        companyId: dto.companyId || null, name: dto.name, code, type: dto.type, country: dto.country || 'India',
        state: dto.state || null, ...period, description: dto.description,
        configuration: dto.configuration as Prisma.InputJsonValue, sourceUrl: dto.sourceUrl, notes: dto.notes,
      },
      include: { company: true },
    });
  }

  async updateRuleStatus(id: string, dto: UpdateComplianceRuleStatusDto) {
    const rule = await this.requireRule(id);
    if (dto.status === 'ACTIVE') {
      await this.noOverlap(rule.tenantId, rule.code, rule.country, rule.state, { effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo }, id, true);
    }
    return this.prisma.complianceRule.update({ where: { id }, data: { status: dto.status } });
  }

  async obligations(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    await this.refreshOverdue(company.id);
    return this.prisma.complianceObligation.findMany({ where: { companyId: company.id }, orderBy: [{ dueDate: 'asc' }, { name: 'asc' }] });
  }

  async createObligation(dto: CreateObligationDto) {
    const company = await this.resolveCompany(dto.companyId);
    return this.prisma.complianceObligation.create({
      data: { companyId: company.id, name: dto.name, code: dto.code.toUpperCase(), periodLabel: dto.periodLabel, dueDate: new Date(dto.dueDate), assignedTo: dto.assignedTo, notes: dto.notes },
    });
  }

  async updateObligationStatus(id: string, dto: UpdateObligationStatusDto) {
    const obligation = await this.prisma.complianceObligation.findUnique({ where: { id } });
    if (!obligation) throw new NotFoundException('Compliance obligation not found');
    return this.prisma.complianceObligation.update({
      where: { id },
      data: { status: dto.status, referenceNo: dto.referenceNo, filedAt: dto.status === 'FILED' ? new Date() : null },
    });
  }

  async readiness(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    await this.refreshOverdue(company.id);
    const [items, employees, activeRules, obligations] = await Promise.all([
      this.prisma.item.findMany({ where: { companyId: company.id, isActive: true, deletedAt: null }, include: { taxRates: true } }),
      this.prisma.employee.findMany({ where: { companyId: company.id, status: 'ACTIVE', deletedAt: null }, include: { salaryStructures: { where: { isActive: true } } } }),
      this.prisma.complianceRule.count({ where: { tenantId: company.tenantId, status: 'ACTIVE', OR: [{ companyId: null }, { companyId: company.id }] } }),
      this.prisma.complianceObligation.findMany({ where: { companyId: company.id, status: { not: 'FILED' } } }),
    ]);
    const checks = [
      { key: 'tax', label: 'Active items have tax periods', passed: items.every((item) => item.taxRates.length), detail: `${items.filter((item) => item.taxRates.length).length}/${items.length} configured` },
      { key: 'hsn', label: 'Inventory HSN/SAC mapping', passed: items.every((item) => item.hsnSac), detail: `${items.filter((item) => item.hsnSac).length}/${items.length} mapped` },
      { key: 'salary', label: 'Employees have salary structures', passed: employees.every((item) => item.salaryStructures.length), detail: `${employees.filter((item) => item.salaryStructures.length).length}/${employees.length} configured` },
      { key: 'rules', label: 'Active statutory rule set', passed: activeRules > 0, detail: `${activeRules} active rules` },
      { key: 'filings', label: 'No overdue filing obligations', passed: obligations.every((item) => item.status !== 'OVERDUE'), detail: `${obligations.length} open obligations` },
    ];
    return { score: Math.round(checks.filter((item) => item.passed).length / checks.length * 100), checks };
  }

  private period(from: string, to?: string) {
    const effectiveFrom = new Date(from);
    const effectiveTo = to ? new Date(to) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) throw new BadRequestException('Effective To cannot be before Effective From');
    return { effectiveFrom, effectiveTo };
  }

  private async noOverlap(tenantId: string, code: string, country: string, state: string | null, period: { effectiveFrom: Date; effectiveTo: Date | null }, excludeId?: string, activeOnly = false) {
    const overlap = await this.prisma.complianceRule.findFirst({
      where: {
        tenantId, code, country, state, ...(excludeId ? { id: { not: excludeId } } : {}),
        status: activeOnly ? 'ACTIVE' : { not: 'ARCHIVED' },
        effectiveFrom: { lte: period.effectiveTo || new Date('9999-12-31') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.effectiveFrom } }],
      },
    });
    if (overlap) throw new BadRequestException(`Rule period overlaps ${overlap.code} version ${overlap.version}`);
  }

  private async refreshOverdue(companyId: string) {
    await this.prisma.complianceObligation.updateMany({
      where: { companyId, dueDate: { lt: new Date() }, status: { in: ['PENDING', 'READY'] } },
      data: { status: 'OVERDUE' },
    });
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const tenant = await this.identity.ensureDefaults();
    const company = await this.prisma.company.findFirst({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!company) throw new BadRequestException('Create a company before managing compliance');
    return company;
  }

  private async requireRule(id: string) {
    const rule = await this.prisma.complianceRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Compliance rule not found');
    return rule;
  }
}
