import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class InstallAddonDto {
  @IsUUID()
  addonId: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}

export class UpdateInstallationDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'TRIAL'])
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
}
