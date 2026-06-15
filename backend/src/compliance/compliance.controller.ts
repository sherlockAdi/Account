import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { CreateComplianceRuleDto, UpdateComplianceRuleDto, UpdateComplianceRuleStatusDto } from './dto/create-compliance-rule.dto';
import { CreateObligationDto, UpdateObligationStatusDto } from './dto/create-obligation.dto';

@ApiTags('Compliance')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Get('dashboard') dashboard(@Query('companyId') companyId?: string) { return this.service.dashboard(companyId); }
  @Get('rules') rules(@Query('companyId') companyId?: string, @Query('type') type?: string, @Query('status') status?: string, @Query('onDate') onDate?: string) {
    return this.service.rules({ companyId, type, status, onDate });
  }
  @Post('rules') createRule(@Body() dto: CreateComplianceRuleDto) { return this.service.createRule(dto); }
  @Patch('rules/:id') updateRule(@Param('id') id: string, @Body() dto: UpdateComplianceRuleDto) { return this.service.updateRule(id, dto); }
  @Patch('rules/:id/status') updateRuleStatus(@Param('id') id: string, @Body() dto: UpdateComplianceRuleStatusDto) { return this.service.updateRuleStatus(id, dto); }
  @Get('obligations') obligations(@Query('companyId') companyId?: string) { return this.service.obligations(companyId); }
  @Post('obligations') createObligation(@Body() dto: CreateObligationDto) { return this.service.createObligation(dto); }
  @Patch('obligations/:id/status') updateObligationStatus(@Param('id') id: string, @Body() dto: UpdateObligationStatusDto) { return this.service.updateObligationStatus(id, dto); }
  @Get('readiness') readiness(@Query('companyId') companyId?: string) { return this.service.readiness(companyId); }
}
