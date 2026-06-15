import { PartialType } from '@nestjs/swagger';
import { CreateVoucherTypeDto } from './create-voucher-type.dto';

export class UpdateVoucherTypeDto extends PartialType(CreateVoucherTypeDto) {}
