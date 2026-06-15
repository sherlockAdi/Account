import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateBomComponentDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wastagePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBomDto {
  @ApiProperty({ example: 'Control Panel BOM' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'CPANEL' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty()
  @IsString()
  finishedItemId: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  outputQuantity?: number;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateBomComponentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBomComponentDto)
  components: CreateBomComponentDto[];
}
