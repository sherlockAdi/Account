import { IsDateString, IsIn, IsObject, IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

export class CreateComplianceRuleDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) code: string;
  @IsIn(['TAX', 'INVOICE', 'PAYROLL', 'NUMBERING', 'STATUTORY'])
  type: 'TAX' | 'INVOICE' | 'PAYROLL' | 'NUMBERING' | 'STATUTORY';
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsOptional() @IsString() description?: string;
  @IsObject() configuration: Record<string, unknown>;
  @IsOptional() @IsUrl({ require_tld: false }) sourceUrl?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateComplianceRuleDto extends CreateComplianceRuleDto {}

export class UpdateComplianceRuleStatusDto {
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}
