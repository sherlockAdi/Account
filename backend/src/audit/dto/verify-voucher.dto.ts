import { VoucherVerificationStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VerifyVoucherDto {
  @ApiProperty({ enum: VoucherVerificationStatus })
  @IsEnum(VoucherVerificationStatus)
  status: VoucherVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}
