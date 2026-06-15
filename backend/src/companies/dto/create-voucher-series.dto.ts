import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateVoucherSeriesDto {
  @ApiProperty({ example: 'sales_invoice' })
  @IsString()
  @MinLength(2)
  module: string;

  @ApiProperty({ example: 'SI-' })
  @IsString()
  prefix: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextNumber?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  padding?: number;

  @ApiPropertyOptional({ example: '/26-27' })
  @IsOptional()
  @IsString()
  suffix?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
