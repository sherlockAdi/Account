import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

class CreateBudgetInitialGrantDto {
  @ApiProperty({ example: 'Grant A' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'GRANT-A' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBudgetTypeDto {
  @ApiProperty({ example: 'Annual Budget' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'ANNUAL' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional({ example: 'ANNUAL' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'cost-center-id' })
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAnnual?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: CreateBudgetInitialGrantDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBudgetInitialGrantDto)
  initialGrant?: CreateBudgetInitialGrantDto;
}
