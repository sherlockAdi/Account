import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateVoucherBudgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetTypeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetGrantId?: string | null;
}
