import { IsOptional, IsString } from 'class-validator';

export class SalesQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
