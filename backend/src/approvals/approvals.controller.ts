import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalPolicyDto, UpdateApprovalPolicyStatusDto } from './dto/create-approval-policy.dto';
import { ApprovalDecisionDto, CreateApprovalRequestDto } from './dto/create-approval-request.dto';

@ApiTags('Approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('dashboard')
  dashboard(@Headers('authorization') authorization?: string) {
    return this.service.dashboard(authorization);
  }

  @Get('policies')
  policies() {
    return this.service.policies();
  }

  @Post('policies')
  createPolicy(@Body() dto: CreateApprovalPolicyDto) {
    return this.service.createPolicy(dto);
  }

  @Patch('policies/:id/status')
  updatePolicyStatus(@Param('id') id: string, @Body() dto: UpdateApprovalPolicyStatusDto) {
    return this.service.updatePolicyStatus(id, dto);
  }

  @Get('requests')
  requests(@Headers('authorization') authorization?: string, @Query('status') status?: string) {
    return this.service.requests(authorization, status);
  }

  @Post('requests')
  createRequest(@Headers('authorization') authorization: string | undefined, @Body() dto: CreateApprovalRequestDto) {
    return this.service.createRequest(authorization, dto);
  }

  @Post('requests/:id/decision')
  decide(@Param('id') id: string, @Headers('authorization') authorization: string | undefined, @Body() dto: ApprovalDecisionDto) {
    return this.service.decide(id, authorization, dto);
  }

  @Get('history')
  history() {
    return this.service.history();
  }
}
