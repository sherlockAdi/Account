import { DebitCredit } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateVoucherLineDto {
  @ApiProperty()
  @IsString()
  ledgerId: string;

  @ApiProperty({ enum: DebitCredit, example: DebitCredit.DEBIT })
  @IsEnum(DebitCredit)
  type: DebitCredit;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;
}

export class CreateVoucherDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voucherTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  budgetGrantId?: string;

  @ApiPropertyOptional({ example: 'journal' })
  @IsOptional()
  @IsString()
  voucherType?: string;

  @ApiPropertyOptional({ example: 'JV-00001' })
  @IsOptional()
  @IsString()
  voucherNo?: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  voucherDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;

  @ApiProperty({ type: [CreateVoucherLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateVoucherLineDto)
  lines: CreateVoucherLineDto[];
}
