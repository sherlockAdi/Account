import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { GstQueryDto } from './dto/gst-query.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { GstService } from './gst.service';

@ApiTags('GST & Tax')
@Controller('gst')
export class GstController {
  constructor(private readonly gstService: GstService) {}

  @Get('tax-rates')
  listTaxRates(@Query('companyId') companyId?: string) {
    return this.gstService.listTaxRates(companyId);
  }

  @Post('tax-rates')
  createTaxRate(@Query('companyId') companyId: string | undefined, @Body() dto: CreateTaxRateDto) {
    return this.gstService.createTaxRate(companyId, dto);
  }

  @Patch('tax-rates/:id')
  updateTaxRate(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.gstService.updateTaxRate(id, dto);
  }

  @Get('reports/gstr-1')
  gstr1(@Query() query: GstQueryDto) {
    return this.gstService.gstr1(query);
  }

  @Get('reports/itc')
  itc(@Query() query: GstQueryDto) {
    return this.gstService.itcSummary(query);
  }

  @Get('reports/gstr-3b')
  gstr3b(@Query() query: GstQueryDto) {
    return this.gstService.gstr3b(query);
  }

  @Get('reports/hsn-summary')
  hsnSummary(@Query() query: GstQueryDto) {
    return this.gstService.hsnSummary(query);
  }
}
