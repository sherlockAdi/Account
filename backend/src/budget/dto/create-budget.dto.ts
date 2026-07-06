import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class BudgetLineDto {
  @ApiProperty()
  @IsString()
  ledgerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  allocatedAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBudgetDto {
  @ApiPropertyOptional({ example: 'budget-type-id' })
  @IsOptional()
  @IsString()
  budgetTypeId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty()
  @IsString()
  fiscalYear: string;

  @ApiPropertyOptional({ example: 'cost-center-id' })
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiProperty()
  @IsDateString()
  periodFrom: string;

  @ApiProperty()
  @IsDateString()
  periodTo: string;

  @ApiPropertyOptional({ enum: BudgetStatus })
  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [BudgetLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineDto)
  lines?: BudgetLineDto[];
}
