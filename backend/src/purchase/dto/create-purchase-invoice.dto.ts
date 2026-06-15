import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreatePurchaseInvoiceLineDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(0)
  rate: number;

}

export class CreatePurchaseInvoiceDto {
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

  @ApiProperty({ example: 'PI-00001' })
  @IsString()
  invoiceNo: string;

  @ApiProperty({ example: '2026-04-03' })
  @IsDateString()
  invoiceDate: string;

  @ApiPropertyOptional({ example: 'SUP-1001' })
  @IsOptional()
  @IsString()
  supplierInvoiceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;

  @ApiProperty({ type: [CreatePurchaseInvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseInvoiceLineDto)
  lines: CreatePurchaseInvoiceLineDto[];
}
