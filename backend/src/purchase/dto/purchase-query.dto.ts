import { IsOptional, IsString } from 'class-validator';

export class PurchaseQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;
}
