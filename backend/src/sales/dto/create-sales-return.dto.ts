import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateSalesReturnLineDto {
  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 1250 })
  @IsNumber()
  @Min(0)
  rate: number;

}

export class CreateSalesReturnDto {
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

  @ApiProperty({ example: 'SR-00001' })
  @IsString()
  returnNo: string;

  @ApiProperty({ example: '2026-04-08' })
  @IsDateString()
  returnDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;

  @ApiProperty({ type: [CreateSalesReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnLineDto)
  lines: CreateSalesReturnLineDto[];
}
