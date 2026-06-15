import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreatePurchaseReturnLineDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(0)
  rate: number;

}

export class CreatePurchaseReturnDto {
  @ApiProperty()
  @IsString()
  vendorId: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ example: 'PR-00001' })
  @IsString()
  returnNo: string;

  @ApiProperty({ example: '2026-04-08' })
  @IsDateString()
  returnDate: string;

  @ApiPropertyOptional({ example: 'SUP-RET-1001' })
  @IsOptional()
  @IsString()
  supplierReturnNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;

  @ApiProperty({ type: [CreatePurchaseReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnLineDto)
  lines: CreatePurchaseReturnLineDto[];
}
