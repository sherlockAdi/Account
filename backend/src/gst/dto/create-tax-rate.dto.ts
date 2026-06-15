import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTaxRateDto {
  @ApiProperty({ example: 'GST 18%' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'GST_18' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ example: 18 })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cgstRate?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sgstRate?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  igstRate?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
