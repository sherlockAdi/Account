import { ApiProperty } from '@nestjs/swagger';

export class ErpModuleDto {
  @ApiProperty({ example: 'accounting' })
  key: string;

  @ApiProperty({ example: 'Accounting' })
  name: string;

  @ApiProperty({ example: 'Core' })
  category: string;

  @ApiProperty({ example: 'planned', enum: ['planned', 'active', 'external'] })
  status: 'planned' | 'active' | 'external';

  @ApiProperty({ example: ['Chart of accounts', 'Ledgers', 'Vouchers'] })
  features: string[];
}
