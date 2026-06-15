import { IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateApprovalRequestDto {
  @IsUUID() policyId: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsString() entityType: string;
  @IsString() entityId: string;
  @IsOptional() @IsString() entityNumber?: string;
  @IsString() @MinLength(2) title: string;
  @IsString() module: string;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class ApprovalDecisionDto {
  @IsString()
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  comments?: string;
}
