import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CompleteProductionDto {
  @ApiProperty({ example: 'PE-00001' })
  @IsString()
  entryNo: string;

  @ApiProperty({ example: '2026-06-13' })
  @IsDateString()
  productionDate: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
