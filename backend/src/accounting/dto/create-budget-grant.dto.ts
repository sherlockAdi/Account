import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateBudgetGrantDto {
  @ApiPropertyOptional({ example: 'budget-type-id' })
  @IsOptional()
  @IsString()
  budgetTypeId?: string;

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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
