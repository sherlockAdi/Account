import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TallySyncDirection } from '@prisma/client';

export class UpdateTallySyncSettingDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional({ example: 9000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  port?: number;

  @ApiPropertyOptional({ example: 'Default Company' })
  @IsOptional()
  @IsString()
  companyName?: string | null;

  @ApiPropertyOptional({ enum: TallySyncDirection, default: TallySyncDirection.BOTH })
  @IsOptional()
  @IsEnum(TallySyncDirection)
  direction?: TallySyncDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(30)
  syncIntervalSeconds?: number;
}
