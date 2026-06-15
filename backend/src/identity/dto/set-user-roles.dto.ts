import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SetUserRolesDto {
  @ApiProperty({ example: ['admin', 'branch_accountant'] })
  @IsArray()
  @IsString({ each: true })
  roleCodes: string[];
}
