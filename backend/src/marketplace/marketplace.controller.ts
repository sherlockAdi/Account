import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateApiAppDto } from './dto/create-api-app.dto';
import { CreateWebhookDto, UpdateWebhookStatusDto } from './dto/create-webhook.dto';
import { InstallAddonDto, UpdateInstallationDto } from './dto/install-addon.dto';
import { MarketplaceService } from './marketplace.service';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('dashboard')
  dashboard(@Query('tenantId') tenantId?: string) {
    return this.marketplaceService.dashboard(tenantId);
  }

  @Get('catalog')
  catalog(@Query('tenantId') tenantId?: string, @Query('category') category?: string) {
    return this.marketplaceService.catalog(tenantId, category);
  }

  @Get('installations')
  installations(@Query('tenantId') tenantId?: string) {
    return this.marketplaceService.installations(tenantId);
  }

  @Post('installations')
  install(@Query('tenantId') tenantId: string | undefined, @Body() dto: InstallAddonDto) {
    return this.marketplaceService.install(tenantId, dto);
  }

  @Patch('installations/:id')
  updateInstallation(@Param('id') id: string, @Body() dto: UpdateInstallationDto) {
    return this.marketplaceService.updateInstallation(id, dto);
  }

  @Delete('installations/:id')
  uninstall(@Param('id') id: string) {
    return this.marketplaceService.uninstall(id);
  }

  @Get('api-apps')
  apiApps(@Query('tenantId') tenantId?: string) {
    return this.marketplaceService.apiApps(tenantId);
  }

  @Post('api-apps')
  createApiApp(@Query('tenantId') tenantId: string | undefined, @Body() dto: CreateApiAppDto) {
    return this.marketplaceService.createApiApp(tenantId, dto);
  }

  @Post('api-apps/:id/rotate-secret')
  rotateSecret(@Param('id') id: string) {
    return this.marketplaceService.rotateApiSecret(id);
  }

  @Delete('api-apps/:id')
  revokeApiApp(@Param('id') id: string) {
    return this.marketplaceService.revokeApiApp(id);
  }

  @Get('webhooks')
  webhooks(@Query('tenantId') tenantId?: string) {
    return this.marketplaceService.webhooks(tenantId);
  }

  @Post('webhooks')
  createWebhook(@Query('tenantId') tenantId: string | undefined, @Body() dto: CreateWebhookDto) {
    return this.marketplaceService.createWebhook(tenantId, dto);
  }

  @Patch('webhooks/:id/status')
  updateWebhookStatus(@Param('id') id: string, @Body() dto: UpdateWebhookStatusDto) {
    return this.marketplaceService.updateWebhookStatus(id, dto);
  }

  @Post('webhooks/:id/test')
  testWebhook(@Param('id') id: string) {
    return this.marketplaceService.testWebhook(id);
  }

  @Delete('webhooks/:id')
  deleteWebhook(@Param('id') id: string) {
    return this.marketplaceService.deleteWebhook(id);
  }
}
