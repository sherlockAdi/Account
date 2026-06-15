import { IsArray, IsString, IsUrl, IsUUID, IsOptional, MinLength } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsUrl({ require_tld: false })
  url: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class UpdateWebhookStatusDto {
  @IsString()
  status: 'ACTIVE' | 'PAUSED';
}
