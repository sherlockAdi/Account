import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReconcileTransactionDto {
  @ApiProperty()
  @IsDateString()
  clearedDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
