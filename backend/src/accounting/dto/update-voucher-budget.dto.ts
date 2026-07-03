import { BudgetFlow } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateVoucherBudgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetTypeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetGrantId?: string | null;

  @ApiPropertyOptional({ enum: BudgetFlow, example: BudgetFlow.UTILIZATION })
  @IsOptional()
  @IsEnum(BudgetFlow)
  budgetFlow?: BudgetFlow | null;
}
