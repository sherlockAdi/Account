import { ApiProperty } from '@nestjs/swagger';
import { BudgetStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateBudgetStatusDto {
  @ApiProperty({ enum: BudgetStatus })
  @IsEnum(BudgetStatus)
  status: BudgetStatus;
}
