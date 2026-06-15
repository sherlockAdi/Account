import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AssignItemTaxRateDto {
  @ApiProperty()
  @IsString()
  taxRateId: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({ example: '2027-03-31' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
