import { IsOptional, IsString } from 'class-validator';

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}
