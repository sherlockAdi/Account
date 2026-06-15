import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductionOrderDto {
  @ApiProperty()
  @IsString()
  bomId: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ example: 'PO-00001' })
  @IsString()
  orderNo: string;

  @ApiProperty({ example: '2026-06-13' })
  @IsDateString()
  orderDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEndDate?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.001)
  plannedQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
