import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'Kilogram' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'KG' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  decimalPlaces?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
