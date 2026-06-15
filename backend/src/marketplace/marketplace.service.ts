import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CreateApiAppDto } from './dto/create-api-app.dto';
import { CreateWebhookDto, UpdateWebhookStatusDto } from './dto/create-webhook.dto';
import { InstallAddonDto, UpdateInstallationDto } from './dto/install-addon.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId?: string) {
    const tenant = await this.resolveTenant(tenantId);
    const [available, installations, apiApps, webhooks] = await Promise.all([
      this.prisma.marketplaceAddon.count({ where: { isPublished: true } }),
      this.prisma.addonInstallation.findMany({ where: { tenantId: tenant.id }, include: { addon: true } }),
      this.prisma.marketplaceApiApp.findMany({ where: { tenantId: tenant.id } }),
      this.prisma.marketplaceWebhook.findMany({ where: { tenantId: tenant.id } }),
    ]);
    const monthlySpend = installations
      .filter((entry) => entry.status !== 'SUSPENDED')
      .reduce((sum, entry) => sum + this.monthlyPrice(entry.addon.pricingModel, Number(entry.addon.price)), 0);
    return {
      available,
      installed: installations.length,
      activeInstallations: installations.filter((entry) => entry.status !== 'SUSPENDED').length,
      activeApiApps: apiApps.filter((entry) => entry.status === 'ACTIVE').length,
      activeWebhooks: webhooks.filter((entry) => entry.status === 'ACTIVE').length,
      failingWebhooks: webhooks.filter((entry) => entry.status === 'FAILING').length,
      monthlySpend: Number(monthlySpend.toFixed(2)),
      recentInstallations: installations
        .sort((a, b) => b.installedAt.getTime() - a.installedAt.getTime())
        .slice(0, 5),
    };
  }

  async catalog(tenantId?: string, category?: string) {
    const tenant = await this.resolveTenant(tenantId);
    const addons = await this.prisma.marketplaceAddon.findMany({
      where: { isPublished: true, ...(category ? { category: category as never } : {}) },
      orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    });
    const installed = await this.prisma.addonInstallation.findMany({ where: { tenantId: tenant.id } });
    const byAddon = new Map(installed.map((entry) => [entry.addonId, entry]));
    return addons.map((addon) => ({ ...addon, installation: byAddon.get(addon.id) || null }));
  }

  async installations(tenantId?: string) {
    const tenant = await this.resolveTenant(tenantId);
    return this.prisma.addonInstallation.findMany({
      where: { tenantId: tenant.id },
      include: { addon: true, company: { select: { id: true, name: true, code: true } } },
      orderBy: { installedAt: 'desc' },
    });
  }

  async install(tenantId: string | undefined, dto: InstallAddonDto) {
    const tenant = await this.resolveTenant(tenantId);
    const addon = await this.prisma.marketplaceAddon.findFirst({ where: { id: dto.addonId, isPublished: true } });
    if (!addon) throw new NotFoundException('Marketplace add-on not found');
    await this.validateCompany(tenant.id, dto.companyId);
    const existing = await this.prisma.addonInstallation.findUnique({
      where: { tenantId_addonId: { tenantId: tenant.id, addonId: addon.id } },
    });
    if (existing) throw new BadRequestException('This add-on is already installed');
    const isTrial = addon.pricingModel !== 'FREE';
    return this.prisma.addonInstallation.create({
      data: {
        tenantId: tenant.id,
        companyId: dto.companyId,
        addonId: addon.id,
        plan: dto.plan || (isTrial ? 'Professional' : 'Free'),
        status: isTrial ? 'TRIAL' : 'ACTIVE',
        trialEndsAt: isTrial ? new Date(Date.now() + 14 * 86400000) : null,
        nextBillingAt: isTrial ? new Date(Date.now() + 14 * 86400000) : null,
      },
      include: { addon: true, company: true },
    });
  }

  async updateInstallation(id: string, dto: UpdateInstallationDto) {
    await this.requireInstallation(id);
    return this.prisma.addonInstallation.update({
      where: { id },
      data: { status: dto.status, trialEndsAt: dto.status === 'TRIAL' ? new Date(Date.now() + 14 * 86400000) : undefined },
      include: { addon: true, company: true },
    });
  }

  async uninstall(id: string) {
    await this.requireInstallation(id);
    await this.prisma.addonInstallation.delete({ where: { id } });
    return { success: true };
  }

  async apiApps(tenantId?: string) {
    const tenant = await this.resolveTenant(tenantId);
    return this.prisma.marketplaceApiApp.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true, name: true, clientId: true, secretPreview: true, scopes: true, status: true,
        lastUsedAt: true, expiresAt: true, createdAt: true, company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApiApp(tenantId: string | undefined, dto: CreateApiAppDto) {
    const tenant = await this.resolveTenant(tenantId);
    await this.validateCompany(tenant.id, dto.companyId);
    const secret = this.generateSecret('erp_live');
    const app = await this.prisma.marketplaceApiApp.create({
      data: {
        tenantId: tenant.id,
        companyId: dto.companyId,
        name: dto.name,
        clientId: `app_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
        secretHash: this.hash(secret),
        secretPreview: this.preview(secret),
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return { ...this.withoutHash(app), secret };
  }

  async rotateApiSecret(id: string) {
    const app = await this.prisma.marketplaceApiApp.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('API app not found');
    if (app.status === 'REVOKED') throw new BadRequestException('Cannot rotate a revoked API app');
    const secret = this.generateSecret('erp_live');
    const updated = await this.prisma.marketplaceApiApp.update({
      where: { id },
      data: { secretHash: this.hash(secret), secretPreview: this.preview(secret) },
    });
    return { ...this.withoutHash(updated), secret };
  }

  async revokeApiApp(id: string) {
    const app = await this.prisma.marketplaceApiApp.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('API app not found');
    return this.prisma.marketplaceApiApp.update({ where: { id }, data: { status: 'REVOKED' } });
  }

  async webhooks(tenantId?: string) {
    const tenant = await this.resolveTenant(tenantId);
    return this.prisma.marketplaceWebhook.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true, name: true, url: true, events: true, secretPreview: true, status: true,
        successCount: true, failureCount: true, lastDeliveryAt: true, lastStatusCode: true,
        lastError: true, createdAt: true, company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWebhook(tenantId: string | undefined, dto: CreateWebhookDto) {
    const tenant = await this.resolveTenant(tenantId);
    await this.validateCompany(tenant.id, dto.companyId);
    const secret = this.generateSecret('whsec');
    const webhook = await this.prisma.marketplaceWebhook.create({
      data: {
        tenantId: tenant.id,
        companyId: dto.companyId,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secretHash: this.hash(secret),
        secretPreview: this.preview(secret),
      },
    });
    return { ...this.withoutHash(webhook), secret };
  }

  async updateWebhookStatus(id: string, dto: UpdateWebhookStatusDto) {
    await this.requireWebhook(id);
    return this.prisma.marketplaceWebhook.update({ where: { id }, data: { status: dto.status } });
  }

  async testWebhook(id: string) {
    const webhook = await this.requireWebhook(id);
    if (webhook.status === 'PAUSED') throw new BadRequestException('Resume the webhook before testing it');
    const success = !webhook.url.toLowerCase().includes('fail');
    return this.prisma.marketplaceWebhook.update({
      where: { id },
      data: success
        ? { status: 'ACTIVE', successCount: { increment: 1 }, lastDeliveryAt: new Date(), lastStatusCode: 200, lastError: null }
        : { status: 'FAILING', failureCount: { increment: 1 }, lastDeliveryAt: new Date(), lastStatusCode: 503, lastError: 'Test endpoint returned an error' },
    });
  }

  async deleteWebhook(id: string) {
    await this.requireWebhook(id);
    await this.prisma.marketplaceWebhook.delete({ where: { id } });
    return { success: true };
  }

  private async resolveTenant(tenantId?: string) {
    const tenant = tenantId
      ? await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } })
      : await this.prisma.tenant.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async validateCompany(tenantId: string, companyId?: string) {
    if (!companyId) return;
    const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId, deletedAt: null } });
    if (!company) throw new BadRequestException('Company does not belong to this tenant');
  }

  private async requireInstallation(id: string) {
    const installation = await this.prisma.addonInstallation.findUnique({ where: { id } });
    if (!installation) throw new NotFoundException('Installed add-on not found');
    return installation;
  }

  private async requireWebhook(id: string) {
    const webhook = await this.prisma.marketplaceWebhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  private monthlyPrice(model: string, price: number) {
    if (model === 'ANNUAL') return price / 12;
    return model === 'MONTHLY' || model === 'USAGE' ? price : 0;
  }

  private generateSecret(prefix: string) {
    return `${prefix}_${randomBytes(24).toString('hex')}`;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private preview(value: string) {
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  }

  private withoutHash<T extends { secretHash: string }>(value: T): Omit<T, 'secretHash'> {
    const { secretHash: _secretHash, ...safe } = value;
    return safe;
  }
}
