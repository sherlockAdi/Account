import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateItemGroupDto } from './dto/create-item-group.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { UpdateItemGroupDto } from './dto/update-item-group.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { InventoryService } from './inventory.service';
import { AssignItemTaxRateDto } from './dto/assign-item-tax-rate.dto';

@ApiTags('Inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('units')
  @ApiOkResponse({ description: 'List units.' })
  listUnits(@Query('companyId') companyId?: string) {
    return this.inventoryService.listUnits(companyId);
  }

  @Post('units')
  @ApiCreatedResponse({ description: 'Create unit.' })
  createUnit(@Query('companyId') companyId: string | undefined, @Body() dto: CreateUnitDto) {
    return this.inventoryService.createUnit(companyId, dto);
  }

  @Patch('units/:id')
  @ApiOkResponse({ description: 'Update unit.' })
  updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.inventoryService.updateUnit(id, dto);
  }

  @Get('groups')
  listGroups(@Query('companyId') companyId?: string) {
    return this.inventoryService.listItemGroups(companyId);
  }

  @Post('groups')
  createGroup(@Query('companyId') companyId: string | undefined, @Body() dto: CreateItemGroupDto) {
    return this.inventoryService.createItemGroup(companyId, dto);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: UpdateItemGroupDto) {
    return this.inventoryService.updateItemGroup(id, dto);
  }

  @Get('items')
  listItems(@Query('companyId') companyId?: string) {
    return this.inventoryService.listItems(companyId);
  }

  @Post('items')
  createItem(@Query('companyId') companyId: string | undefined, @Body() dto: CreateItemDto) {
    return this.inventoryService.createItem(companyId, dto);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.inventoryService.updateItem(id, dto);
  }

  @Get('items/:id/tax-rates')
  listItemTaxRates(@Param('id') id: string) {
    return this.inventoryService.listItemTaxRates(id);
  }

  @Post('items/:id/tax-rates')
  assignItemTaxRate(@Param('id') id: string, @Body() dto: AssignItemTaxRateDto) {
    return this.inventoryService.assignItemTaxRate(id, dto);
  }

  @Get('movements')
  listMovements(@Query() query: InventoryQueryDto) {
    return this.inventoryService.listMovements(query);
  }

  @Post('movements')
  createMovement(@Body() dto: CreateStockMovementDto) {
    return this.inventoryService.createStockMovement(dto);
  }

  @Get('reports/stock-summary')
  stockSummary(@Query() query: InventoryQueryDto) {
    return this.inventoryService.stockSummary(query);
  }
}
