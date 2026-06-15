import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateItemGroupDto {
  @ApiProperty({ example: 'Raw Materials' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'RAW' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
