import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentAdviceDto {
  @ApiProperty()
  @IsString()
  bankLedgerId: string;

  @ApiProperty()
  @IsString()
  beneficiaryLedgerId: string;

  @ApiProperty()
  @IsString()
  adviceNo: string;

  @ApiProperty()
  @IsDateString()
  adviceDate: string;

  @ApiProperty()
  @IsDateString()
  paymentDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'NEFT' })
  @IsString()
  paymentMode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;
}
