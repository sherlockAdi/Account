import { Body, Controller, Get, Headers, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { VerifyVoucherDto } from './dto/verify-voucher.dto';

@ApiTags('Audit & Security')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('dashboard')
  dashboard(@Query('companyId') companyId?: string) {
    return this.auditService.dashboard(companyId);
  }

  @Get('logs')
  logs(@Query() query: AuditQueryDto) {
    return this.auditService.logs(query);
  }

  @Get('vouchers')
  vouchers(@Query('companyId') companyId?: string) {
    return this.auditService.voucherVerifications(companyId);
  }

  @Patch('vouchers/:id/verify')
  verifyVoucher(
    @Param('id') id: string,
    @Body() dto: VerifyVoucherDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.auditService.verifyVoucher(id, dto, this.userId(authorization));
  }

  @Get('security')
  security(@Query('companyId') companyId?: string) {
    return this.auditService.securitySummary(companyId);
  }

  private userId(authorization?: string) {
    try {
      const token = authorization?.split(' ')[1];
      if (!token) return undefined;
      return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub as string | undefined;
    } catch {
      return undefined;
    }
  }
}
