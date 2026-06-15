import { PartialType } from '@nestjs/swagger';
import { CreateVoucherSeriesDto } from './create-voucher-series.dto';

export class UpdateVoucherSeriesDto extends PartialType(CreateVoucherSeriesDto) {}
