import { PartialType } from '@nestjs/swagger';
import { CreateLedgerTypeMasterDto } from './create-ledger-type-master.dto';

export class UpdateLedgerTypeMasterDto extends PartialType(CreateLedgerTypeMasterDto) {}
