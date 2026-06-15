import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateObligationDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) code: string;
  @IsString() periodLabel: string;
  @IsDateString() dueDate: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateObligationStatusDto {
  @IsIn(['PENDING', 'READY', 'FILED', 'OVERDUE'])
  status: 'PENDING' | 'READY' | 'FILED' | 'OVERDUE';
  @IsOptional() @IsString() referenceNo?: string;
}
