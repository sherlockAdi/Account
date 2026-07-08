import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { AccountingQueryDto } from './dto/accounting-query.dto';
import { CreateAccountGroupDto } from './dto/create-account-group.dto';
import { CreateBudgetGrantDto } from './dto/create-budget-grant.dto';
import { CreateBudgetTypeDto } from './dto/create-budget-type.dto';
import { CreateLedgerDto } from './dto/create-ledger.dto';
import { CreateLedgerTypeMasterDto } from './dto/create-ledger-type-master.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { CreateVoucherTypeDto } from './dto/create-voucher-type.dto';
import { UpdateAccountGroupDto } from './dto/update-account-group.dto';
import { UpdateLedgerDto } from './dto/update-ledger.dto';
import { UpdateLedgerTypeMasterDto } from './dto/update-ledger-type-master.dto';
import { UpdateVoucherBudgetDto } from './dto/update-voucher-budget.dto';
import { UpdateVoucherTypeDto } from './dto/update-voucher-type.dto';

@ApiTags('Accounting')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('groups')
  @ApiOkResponse({ description: 'List account groups.' })
  listGroups(@Query('companyId') companyId?: string) {
    return this.accountingService.listGroups(companyId);
  }

  @Post('groups')
  @ApiCreatedResponse({ description: 'Create account group.' })
  createGroup(@Query('companyId') companyId: string | undefined, @Body() dto: CreateAccountGroupDto) {
    return this.accountingService.createGroup(companyId, dto);
  }

  @Patch('groups/:id')
  @ApiOkResponse({ description: 'Update account group.' })
  updateGroup(@Param('id') id: string, @Body() dto: UpdateAccountGroupDto) {
    return this.accountingService.updateGroup(id, dto);
  }

  @Get('ledgers')
  @ApiOkResponse({ description: 'List ledgers.' })
  listLedgers(@Query('companyId') companyId?: string) {
    return this.accountingService.listLedgers(companyId);
  }

  @Post('ledgers')
  @ApiCreatedResponse({ description: 'Create ledger.' })
  createLedger(@Query('companyId') companyId: string | undefined, @Body() dto: CreateLedgerDto) {
    return this.accountingService.createLedger(companyId, dto);
  }

  @Patch('ledgers/:id')
  @ApiOkResponse({ description: 'Update ledger.' })
  updateLedger(@Param('id') id: string, @Body() dto: UpdateLedgerDto) {
    return this.accountingService.updateLedger(id, dto);
  }

  @Get('ledger-types')
  @ApiOkResponse({ description: 'List ledger type masters.' })
  listLedgerTypes(@Query('companyId') companyId?: string) {
    return this.accountingService.listLedgerTypes(companyId);
  }

  @Post('ledger-types')
  @ApiCreatedResponse({ description: 'Create ledger type master.' })
  createLedgerType(@Query('companyId') companyId: string | undefined, @Body() dto: CreateLedgerTypeMasterDto) {
    return this.accountingService.createLedgerType(companyId, dto);
  }

  @Patch('ledger-types/:id')
  @ApiOkResponse({ description: 'Update ledger type master.' })
  updateLedgerType(@Param('id') id: string, @Body() dto: UpdateLedgerTypeMasterDto) {
    return this.accountingService.updateLedgerType(id, dto);
  }

  @Get('voucher-types')
  @ApiOkResponse({ description: 'List voucher type masters with numbering pattern.' })
  listVoucherTypes(@Query('companyId') companyId?: string) {
    return this.accountingService.listVoucherTypes(companyId);
  }

  @Post('voucher-types')
  @ApiCreatedResponse({ description: 'Create voucher type master.' })
  createVoucherType(@Query('companyId') companyId: string | undefined, @Body() dto: CreateVoucherTypeDto) {
    return this.accountingService.createVoucherType(companyId, dto);
  }

  @Patch('voucher-types/:id')
  @ApiOkResponse({ description: 'Update voucher type master.' })
  updateVoucherType(@Param('id') id: string, @Body() dto: UpdateVoucherTypeDto) {
    return this.accountingService.updateVoucherType(id, dto);
  }

  @Get('budgets')
  @ApiOkResponse({ description: 'List budget masters with grants and utilization.' })
  listBudgets(@Query('companyId') companyId?: string) {
    return this.accountingService.listBudgets(companyId);
  }

  @Post('budgets')
  @ApiCreatedResponse({ description: 'Create budget master.' })
  createBudget(@Query('companyId') companyId: string | undefined, @Body() dto: CreateBudgetTypeDto) {
    return this.accountingService.createBudget(companyId, dto);
  }

  @Post('budgets/:budgetTypeId/grants')
  @ApiCreatedResponse({ description: 'Create budget grant.' })
  createBudgetGrant(@Query('companyId') companyId: string | undefined, @Param('budgetTypeId') budgetTypeId: string, @Body() dto: CreateBudgetGrantDto) {
    return this.accountingService.createBudgetGrant(companyId, budgetTypeId, dto);
  }

  @Post('grants')
  @ApiCreatedResponse({ description: 'Create budget grant with optional budget mapping.' })
  createGrant(@Query('companyId') companyId: string | undefined, @Body() dto: CreateBudgetGrantDto) {
    return this.accountingService.createBudgetGrantOptional(companyId, dto);
  }

  @Get('vouchers')
  @ApiOkResponse({ description: 'List vouchers/day book.' })
  listVouchers(@Query() query: AccountingQueryDto) {
    return this.accountingService.listVouchers(query);
  }

  @Get('vouchers/:id')
  @ApiOkResponse({ description: 'Get voucher detail.' })
  getVoucher(@Param('id') id: string, @Query('companyId') companyId?: string) {
    return this.accountingService.getVoucher(id, companyId);
  }

  @Post('vouchers')
  @ApiCreatedResponse({ description: 'Create balanced voucher.' })
  createVoucher(@Query('companyId') companyId: string | undefined, @Body() dto: CreateVoucherDto) {
    return this.accountingService.createVoucher(companyId, dto);
  }

  @Patch('vouchers/:id/budget')
  @ApiOkResponse({ description: 'Update voucher budget/grant selection.' })
  updateVoucherBudget(@Query('companyId') companyId: string | undefined, @Param('id') id: string, @Body() dto: UpdateVoucherBudgetDto) {
    return this.accountingService.updateVoucherBudget(companyId, id, dto);
  }

  @Get('reports/trial-balance')
  @ApiOkResponse({ description: 'Trial balance.' })
  trialBalance(@Query() query: AccountingQueryDto) {
    return this.accountingService.trialBalance(query);
  }

  @Get('reports/day-book')
  @ApiOkResponse({ description: 'Day book.' })
  dayBook(@Query() query: AccountingQueryDto) {
    return this.accountingService.dayBook(query);
  }

  @Get('reports/ledger/:ledgerId')
  @ApiOkResponse({ description: 'Ledger report.' })
  ledgerReport(@Param('ledgerId') ledgerId: string, @Query() query: AccountingQueryDto) {
    return this.accountingService.ledgerReport(ledgerId, query);
  }
}
