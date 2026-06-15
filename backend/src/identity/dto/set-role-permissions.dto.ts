import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SetRolePermissionsDto {
  @ApiProperty({ example: ['accounting.voucher.create', 'accounting.ledger.read'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}
