import { PartialType } from '@nestjs/swagger';
import { CreateItemGroupDto } from './create-item-group.dto';

export class UpdateItemGroupDto extends PartialType(CreateItemGroupDto) {}
