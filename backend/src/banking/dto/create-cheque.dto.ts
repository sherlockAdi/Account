import { ChequeDirection, ChequeStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateChequeDto {
  @ApiProperty()
  @IsString()
  bankLedgerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyLedgerId?: string;

  @ApiProperty({ example: '000123' })
  @IsString()
  chequeNo: string;

  @ApiProperty()
  @IsDateString()
  chequeDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ChequeDirection })
  @IsEnum(ChequeDirection)
  direction: ChequeDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payeeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateChequeStatusDto {
  @ApiProperty({ enum: ChequeStatus })
  @IsEnum(ChequeStatus)
  status: ChequeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clearedDate?: string;
}
