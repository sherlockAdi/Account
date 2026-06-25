import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateVoucherSeriesDto } from './dto/create-voucher-series.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateVoucherSeriesDto } from './dto/update-voucher-series.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@ApiTags('Companies & Branches')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOkResponse({ description: 'List companies with branches, warehouses, and voucher series.' })
  listCompanies(@Query('summary') summary?: string) {
    return this.companiesService.listCompanies(summary === 'true');
  }

  @Post()
  @ApiCreatedResponse({ description: 'Create a company.' })
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.companiesService.createCompany(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Update a company.' })
  updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateCompany(id, dto);
  }

  @Get(':companyId/branches')
  @ApiOkResponse({ description: 'List branches for a company.' })
  listBranches(@Param('companyId') companyId: string) {
    return this.companiesService.listBranches(companyId);
  }

  @Post(':companyId/branches')
  @ApiCreatedResponse({ description: 'Create a branch for a company.' })
  createBranch(@Param('companyId') companyId: string, @Body() dto: CreateBranchDto) {
    return this.companiesService.createBranch(companyId, dto);
  }

  @Patch('branches/:id')
  @ApiOkResponse({ description: 'Update a branch.' })
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.companiesService.updateBranch(id, dto);
  }

  @Get('branches/:branchId/warehouses')
  @ApiOkResponse({ description: 'List warehouses for a branch.' })
  listWarehouses(@Param('branchId') branchId: string) {
    return this.companiesService.listWarehouses(branchId);
  }

  @Post('branches/:branchId/warehouses')
  @ApiCreatedResponse({ description: 'Create a warehouse/godown for a branch.' })
  createWarehouse(@Param('branchId') branchId: string, @Body() dto: CreateWarehouseDto) {
    return this.companiesService.createWarehouse(branchId, dto);
  }

  @Patch('warehouses/:id')
  @ApiOkResponse({ description: 'Update a warehouse/godown.' })
  updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.companiesService.updateWarehouse(id, dto);
  }

  @Get(':companyId/voucher-series')
  @ApiOkResponse({ description: 'List voucher numbering series for a company.' })
  listVoucherSeries(@Param('companyId') companyId: string) {
    return this.companiesService.listVoucherSeries(companyId);
  }

  @Post(':companyId/voucher-series')
  @ApiCreatedResponse({ description: 'Create voucher numbering series for a company.' })
  createVoucherSeries(@Param('companyId') companyId: string, @Body() dto: CreateVoucherSeriesDto) {
    return this.companiesService.createVoucherSeries(companyId, dto);
  }

  @Patch('voucher-series/:id')
  @ApiOkResponse({ description: 'Update voucher numbering series.' })
  updateVoucherSeries(@Param('id') id: string, @Body() dto: UpdateVoucherSeriesDto) {
    return this.companiesService.updateVoucherSeries(id, dto);
  }
}
