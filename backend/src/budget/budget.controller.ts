import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetStatusDto } from './dto/update-budget-status.dto';

@ApiTags('Budget')
@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('dashboard')
  dashboard(@Query('companyId') companyId?: string) {
    return this.budgetService.dashboard(companyId);
  }

  @Get('budgets')
  budgets(@Query('companyId') companyId?: string) {
    return this.budgetService.budgets(companyId);
  }

  @Get('ledgers')
  ledgers(@Query('companyId') companyId?: string) {
    return this.budgetService.ledgers(companyId);
  }

  @Get('branches')
  branches(@Query('companyId') companyId?: string) {
    return this.budgetService.branches(companyId);
  }

  @Post('budgets')
  createBudget(@Query('companyId') companyId: string | undefined, @Body() dto: CreateBudgetDto) {
    return this.budgetService.createBudget(companyId, dto);
  }

  @Patch('budgets/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBudgetStatusDto) {
    return this.budgetService.updateStatus(id, dto);
  }
}
