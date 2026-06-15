import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompleteProductionDto } from './dto/complete-production.dto';
import { CreateBomDto } from './dto/create-bom.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { ManufacturingService } from './manufacturing.service';

@ApiTags('Manufacturing')
@Controller('manufacturing')
export class ManufacturingController {
  constructor(private readonly manufacturingService: ManufacturingService) {}

  @Get('boms')
  listBoms(@Query('companyId') companyId?: string) {
    return this.manufacturingService.listBoms(companyId);
  }

  @Post('boms')
  createBom(@Query('companyId') companyId: string | undefined, @Body() dto: CreateBomDto) {
    return this.manufacturingService.createBom(companyId, dto);
  }

  @Get('orders')
  listOrders(@Query('companyId') companyId?: string) {
    return this.manufacturingService.listOrders(companyId);
  }

  @Post('orders')
  createOrder(@Query('companyId') companyId: string | undefined, @Body() dto: CreateProductionOrderDto) {
    return this.manufacturingService.createOrder(companyId, dto);
  }

  @Get('orders/:id/material-requirements')
  materialRequirements(@Param('id') id: string) {
    return this.manufacturingService.materialRequirements(id);
  }

  @Post('orders/:id/complete')
  completeProduction(@Param('id') id: string, @Body() dto: CompleteProductionDto) {
    return this.manufacturingService.completeProduction(id, dto);
  }

  @Get('dashboard')
  dashboard(@Query('companyId') companyId?: string) {
    return this.manufacturingService.dashboard(companyId);
  }
}
