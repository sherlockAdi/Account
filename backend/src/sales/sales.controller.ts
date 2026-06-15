import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('customers')
  listCustomers(@Query('companyId') companyId?: string) {
    return this.salesService.listCustomers(companyId);
  }

  @Post('customers')
  createCustomer(@Query('companyId') companyId: string | undefined, @Body() dto: CreateCustomerDto) {
    return this.salesService.createCustomer(companyId, dto);
  }

  @Patch('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.salesService.updateCustomer(id, dto);
  }

  @Get('invoices')
  listInvoices(@Query() query: SalesQueryDto) {
    return this.salesService.listInvoices(query);
  }

  @Post('invoices')
  createInvoice(@Query('companyId') companyId: string | undefined, @Body() dto: CreateSalesInvoiceDto) {
    return this.salesService.createInvoice(companyId, dto);
  }

  @Get('returns')
  listReturns(@Query() query: SalesQueryDto) {
    return this.salesService.listReturns(query);
  }

  @Post('returns')
  createReturn(@Query('companyId') companyId: string | undefined, @Body() dto: CreateSalesReturnDto) {
    return this.salesService.createReturn(companyId, dto);
  }

  @Get('reports/customer-outstanding')
  customerOutstanding(@Query() query: SalesQueryDto) {
    return this.salesService.customerOutstanding(query);
  }
}
