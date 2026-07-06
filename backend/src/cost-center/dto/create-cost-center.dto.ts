import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCostCenterDto {
  @ApiProperty({ example: 'Head Office' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'HO' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional({ example: 'Main company office' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
