import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'MS Sheet 2mm' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'MS-SHEET-2MM' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty()
  @IsString()
  unitId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ example: 'GOODS' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: '7208' })
  @IsOptional()
  @IsString()
  hsnSac?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  standardRate?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  trackBatch?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  trackSerial?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxRateId?: string;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  taxEffectiveFrom?: string;

  @ApiPropertyOptional({ example: '2027-03-31' })
  @IsOptional()
  @IsDateString()
  taxEffectiveTo?: string;
}
