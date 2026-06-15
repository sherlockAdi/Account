import { DebitCredit, LedgerType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLedgerDto {
  @ApiProperty({ example: 'Cash' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'CASH' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty()
  @IsString()
  groupId: string;

  @ApiPropertyOptional({ enum: LedgerType, example: LedgerType.BANK })
  @IsOptional()
  @IsEnum(LedgerType)
  ledgerType?: LedgerType;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @ApiPropertyOptional({ enum: DebitCredit, example: DebitCredit.DEBIT })
  @IsOptional()
  @IsEnum(DebitCredit)
  openingType?: DebitCredit;

  @ApiPropertyOptional({ example: 'State Bank of India' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  bankAccountNo?: string;

  @ApiPropertyOptional({ example: 'SBIN0001234' })
  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @ApiPropertyOptional({ example: 'Mumbai Main' })
  @IsOptional()
  @IsString()
  bankBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
