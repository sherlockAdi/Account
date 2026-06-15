import { StockMovementType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockMovementDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.OPENING })
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ example: 1250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  movementDate: string;

  @ApiPropertyOptional({ example: 'Opening stock' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'OPEN-001' })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;
}
