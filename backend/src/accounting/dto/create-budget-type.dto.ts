import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
}
