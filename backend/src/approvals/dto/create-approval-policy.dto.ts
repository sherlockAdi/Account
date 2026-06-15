import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';

export class ApprovalPolicyStepDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) approverRoleCode: string;
  @IsOptional() @IsInt() @Min(1) minApprovals?: number;
  @IsOptional() @IsInt() @Min(1) escalationHours?: number;
}

export class CreateApprovalPolicyDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) code: string;
  @IsString() module: string;
  @IsString() entityType: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @IsNumber() @Min(0) maxAmount?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() description?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ApprovalPolicyStepDto)
  steps: ApprovalPolicyStepDto[];
}

export class UpdateApprovalPolicyStatusDto {
  @IsBoolean()
  isActive: boolean;
}
