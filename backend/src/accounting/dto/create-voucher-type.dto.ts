import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateVoucherTypeDto {
  @ApiProperty({ example: 'Journal' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'journal' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ example: 'accounting' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'JV-' })
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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
