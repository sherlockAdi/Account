import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PurchaseService } from './purchase.service';

@ApiTags('Purchase')
@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get('vendors')
  @ApiOkResponse({ description: 'List vendors.' })
  listVendors(@Query('companyId') companyId?: string) {
    return this.purchaseService.listVendors(companyId);
  }

  @Post('vendors')
  @ApiCreatedResponse({ description: 'Create vendor and vendor ledger.' })
  createVendor(@Query('companyId') companyId: string | undefined, @Body() dto: CreateVendorDto) {
    return this.purchaseService.createVendor(companyId, dto);
  }

  @Patch('vendors/:id')
  updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.purchaseService.updateVendor(id, dto);
  }

  @Get('invoices')
  listInvoices(@Query() query: PurchaseQueryDto) {
    return this.purchaseService.listInvoices(query);
  }

  @Post('invoices')
  createInvoice(@Query('companyId') companyId: string | undefined, @Body() dto: CreatePurchaseInvoiceDto) {
    return this.purchaseService.createInvoice(companyId, dto);
  }

  @Get('returns')
  listReturns(@Query() query: PurchaseQueryDto) {
    return this.purchaseService.listReturns(query);
  }

  @Post('returns')
  createReturn(@Query('companyId') companyId: string | undefined, @Body() dto: CreatePurchaseReturnDto) {
    return this.purchaseService.createReturn(companyId, dto);
  }

  @Get('reports/vendor-outstanding')
  vendorOutstanding(@Query() query: PurchaseQueryDto) {
    return this.purchaseService.vendorOutstanding(query);
  }
}
