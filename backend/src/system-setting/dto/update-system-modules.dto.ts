import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSystemModulesDto {
  @ApiProperty()
  @IsBoolean()
  budget: boolean;

  @ApiProperty()
  @IsBoolean()
  grant: boolean;

  @ApiProperty()
  @IsBoolean()
  payroll: boolean;

  @ApiProperty()
  @IsBoolean()
  sales: boolean;

  @ApiProperty()
  @IsBoolean()
  purchase: boolean;

  @ApiProperty()
  @IsBoolean()
  costCenter: boolean;
}
