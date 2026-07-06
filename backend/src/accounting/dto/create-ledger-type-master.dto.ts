import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLedgerTypeMasterDto {
  @ApiProperty({ example: 'General' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'GENERAL' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional({ example: 'Default ledger type' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
