import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertAttendanceDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  workingDays: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  payableDays: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
