import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { CostCenterService } from './cost-center.service';

@ApiTags('Cost Centre')
@Controller('cost-center')
export class CostCenterController {
  constructor(private readonly costCenterService: CostCenterService) {}

  @Get('centers')
  @ApiOkResponse({ description: 'List cost centres.' })
  listCostCenters(@Query('companyId') companyId?: string) {
    return this.costCenterService.listCostCenters(companyId);
  }

  @Post('centers')
  @ApiCreatedResponse({ description: 'Create cost centre.' })
  createCostCenter(@Query('companyId') companyId: string | undefined, @Body() dto: CreateCostCenterDto) {
    return this.costCenterService.createCostCenter(companyId, dto);
  }

  @Patch('centers/:id')
  @ApiOkResponse({ description: 'Update cost centre.' })
  updateCostCenter(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.costCenterService.updateCostCenter(id, dto);
  }
}
