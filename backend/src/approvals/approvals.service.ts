import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateApprovalPolicyDto, UpdateApprovalPolicyStatusDto } from './dto/create-approval-policy.dto';
import { ApprovalDecisionDto, CreateApprovalRequestDto } from './dto/create-approval-request.dto';

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService, private readonly identity: IdentityService) {}

  async dashboard(authorization?: string) {
    const actor = await this.resolveActor(authorization);
    await this.refreshEscalations();
    const [requests, policies] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where: { tenantId: actor.tenantId },
        include: this.requestInclude(),
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.approvalPolicy.count({ where: { tenantId: actor.tenantId, isActive: true } }),
    ]);
    const pending = requests.filter((item) => item.status === 'PENDING');
    return {
      pending: pending.length,
      myPending: pending.filter((item) => this.canApprove(item, actor)).length,
      overdue: pending.filter((item) => item.dueAt && item.dueAt < new Date()).length,
      approvedThisMonth: requests.filter((item) => item.status === 'APPROVED' && item.completedAt && item.completedAt >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length,
      activePolicies: policies,
      pendingValue: this.money(pending.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
      inbox: pending.filter((item) => this.canApprove(item, actor)).slice(0, 6),
      recent: requests.slice(0, 6),
    };
  }

  async policies() {
    const tenant = await this.identity.ensureDefaults();
    return this.prisma.approvalPolicy.findMany({
      where: { tenantId: tenant.id },
      include: { steps: { orderBy: { sequence: 'asc' } }, company: { select: { id: true, name: true } }, _count: { select: { requests: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createPolicy(dto: CreateApprovalPolicyDto) {
    if (!dto.steps.length) throw new BadRequestException('At least one approval step is required');
    if (dto.maxAmount !== undefined && dto.minAmount !== undefined && dto.maxAmount < dto.minAmount) {
      throw new BadRequestException('Maximum amount cannot be below minimum amount');
    }
    const tenant = await this.identity.ensureDefaults();
    await this.validateCompany(tenant.id, dto.companyId);
    await this.validateRoles(tenant.id, dto.steps.map((step) => step.approverRoleCode));
    return this.prisma.approvalPolicy.create({
      data: {
        tenantId: tenant.id, companyId: dto.companyId, name: dto.name, code: dto.code.toUpperCase(),
        module: dto.module, entityType: dto.entityType, minAmount: dto.minAmount, maxAmount: dto.maxAmount,
        isActive: dto.isActive ?? true, description: dto.description,
        steps: { create: dto.steps.map((step, index) => ({ sequence: index + 1, name: step.name, approverRoleCode: step.approverRoleCode, minApprovals: step.minApprovals || 1, escalationHours: step.escalationHours })) },
      },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
  }

  async updatePolicyStatus(id: string, dto: UpdateApprovalPolicyStatusDto) {
    await this.requirePolicy(id);
    return this.prisma.approvalPolicy.update({ where: { id }, data: { isActive: dto.isActive } });
  }

  async requests(authorization?: string, status?: string) {
    const actor = await this.resolveActor(authorization);
    await this.refreshEscalations();
    const requests = await this.prisma.approvalRequest.findMany({
      where: { tenantId: actor.tenantId, ...(status ? { status: status as never } : {}) },
      include: this.requestInclude(),
      orderBy: { submittedAt: 'desc' },
    });
    return requests.map((item) => ({ ...item, canApprove: item.status === 'PENDING' && this.canApprove(item, actor), isMaker: item.makerId === actor.id }));
  }

  async createRequest(authorization: string | undefined, dto: CreateApprovalRequestDto) {
    const maker = await this.resolveActor(authorization);
    const policy = await this.prisma.approvalPolicy.findFirst({
      where: { id: dto.policyId, tenantId: maker.tenantId, isActive: true },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
    if (!policy) throw new NotFoundException('Active approval policy not found');
    if (policy.module !== dto.module || policy.entityType !== dto.entityType) throw new BadRequestException('Request does not match the selected policy');
    const amount = dto.amount ?? 0;
    if (policy.minAmount !== null && amount < Number(policy.minAmount)) throw new BadRequestException('Amount is below the policy threshold');
    if (policy.maxAmount !== null && amount > Number(policy.maxAmount)) throw new BadRequestException('Amount is above the policy threshold');
    await this.validateCompany(maker.tenantId, dto.companyId);
    const first = policy.steps[0];
    if (!first) throw new BadRequestException('Approval policy has no steps');
    return this.prisma.approvalRequest.create({
      data: {
        tenantId: maker.tenantId, companyId: dto.companyId || policy.companyId, policyId: policy.id,
        entityType: dto.entityType, entityId: dto.entityId, entityNumber: dto.entityNumber,
        title: dto.title, module: dto.module, amount: dto.amount, makerId: maker.id, currentStep: 1,
        dueAt: first.escalationHours ? new Date(Date.now() + first.escalationHours * 3600000) : null,
        notes: dto.notes, metadata: dto.metadata as Prisma.InputJsonValue,
      },
      include: this.requestInclude(),
    });
  }

  async decide(id: string, authorization: string | undefined, dto: ApprovalDecisionDto) {
    if (!['APPROVED', 'REJECTED'].includes(dto.decision)) throw new BadRequestException('Invalid approval decision');
    const actor = await this.resolveActor(authorization);
    const request = await this.prisma.approvalRequest.findUnique({ where: { id }, include: this.requestInclude() });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('This request is already completed');
    if (request.makerId === actor.id) throw new ForbiddenException('Maker cannot approve or reject their own request');
    const step = request.policy.steps.find((item) => item.sequence === request.currentStep);
    if (!step) throw new BadRequestException('Current approval step is invalid');
    if (!actor.roles.includes('admin') && !actor.roles.includes(step.approverRoleCode)) {
      throw new ForbiddenException(`This step requires the ${step.approverRoleCode} role`);
    }
    const existing = request.decisions.find((item) => item.stepId === step.id && item.approverId === actor.id);
    if (existing) throw new BadRequestException('You have already decided this step');

    return this.prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: { requestId: request.id, stepId: step.id, approverId: actor.id, decision: dto.decision, comments: dto.comments },
      });
      if (dto.decision === 'REJECTED') {
        return tx.approvalRequest.update({
          where: { id }, data: { status: 'REJECTED', completedAt: new Date(), dueAt: null },
          include: this.requestInclude(),
        });
      }
      const approvalsAtStep = request.decisions.filter((item) => item.stepId === step.id && item.decision === 'APPROVED').length + 1;
      if (approvalsAtStep < step.minApprovals) {
        return tx.approvalRequest.findUniqueOrThrow({ where: { id }, include: this.requestInclude() });
      }
      const nextStep = request.policy.steps.find((item) => item.sequence === request.currentStep + 1);
      return tx.approvalRequest.update({
        where: { id },
        data: nextStep
          ? { currentStep: nextStep.sequence, dueAt: nextStep.escalationHours ? new Date(Date.now() + nextStep.escalationHours * 3600000) : null }
          : { status: 'APPROVED', completedAt: new Date(), dueAt: null },
        include: this.requestInclude(),
      });
    });
  }

  async history() {
    const tenant = await this.identity.ensureDefaults();
    return this.prisma.approvalDecision.findMany({
      where: { request: { tenantId: tenant.id } },
      include: {
        approver: { select: { id: true, fullName: true, email: true } },
        step: true,
        request: { select: { id: true, title: true, entityNumber: true, module: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private requestInclude() {
    return {
      policy: { include: { steps: { orderBy: { sequence: 'asc' as const } } } },
      maker: { select: { id: true, fullName: true, email: true } },
      company: { select: { id: true, name: true, code: true } },
      decisions: { include: { approver: { select: { id: true, fullName: true, email: true } }, step: true }, orderBy: { createdAt: 'asc' as const } },
    };
  }

  private canApprove(request: any, actor: { id: string; roles: string[] }) {
    if (request.makerId === actor.id) return false;
    const step = request.policy.steps.find((item: any) => item.sequence === request.currentStep);
    return Boolean(step && (actor.roles.includes('admin') || actor.roles.includes(step.approverRoleCode)));
  }

  private async resolveActor(authorization?: string) {
    let userId: string | undefined;
    try {
      const token = authorization?.split(' ')[1];
      if (token) userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;
    } catch {}
    const tenant = await this.identity.ensureDefaults();
    const user = userId
      ? await this.prisma.user.findFirst({ where: { id: userId, tenantId: tenant.id, deletedAt: null }, include: { roles: { include: { role: true } } } })
      : await this.prisma.user.findFirst({ where: { tenantId: tenant.id, deletedAt: null }, include: { roles: { include: { role: true } } }, orderBy: { createdAt: 'asc' } });
    if (!user) throw new NotFoundException('Approval user not found');
    return { id: user.id, tenantId: user.tenantId, roles: user.roles.map((item) => item.role.code) };
  }

  private async requirePolicy(id: string) {
    const policy = await this.prisma.approvalPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('Approval policy not found');
    return policy;
  }

  private async validateCompany(tenantId: string, companyId?: string | null) {
    if (!companyId) return;
    const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId, deletedAt: null } });
    if (!company) throw new BadRequestException('Company does not belong to this tenant');
  }

  private async validateRoles(tenantId: string, codes: string[]) {
    const unique = [...new Set(codes)];
    const roles = await this.prisma.role.findMany({ where: { tenantId, code: { in: unique }, deletedAt: null } });
    if (roles.length !== unique.length) throw new BadRequestException('One or more approver roles do not exist');
  }

  private async refreshEscalations() {
    // Due dates are derived at each step; dashboard and inbox expose overdue requests for escalation handling.
    return Promise.resolve();
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }
}
