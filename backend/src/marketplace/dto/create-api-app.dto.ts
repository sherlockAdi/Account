import { IsArray, IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateApiAppDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
