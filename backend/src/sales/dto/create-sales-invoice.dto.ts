import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateSalesInvoiceLineDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 1250 })
  @IsNumber()
  @Min(0)
  rate: number;

}

export class CreateSalesInvoiceDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ example: 'SI-00001' })
  @IsString()
  invoiceNo: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  invoiceDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;

  @ApiProperty({ type: [CreateSalesInvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceLineDto)
  lines: CreateSalesInvoiceLineDto[];
}
