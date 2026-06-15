import { AccountNature } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccountGroupDto {
  @ApiProperty({ example: 'Current Assets' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'CURRENT_ASSETS' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ enum: AccountNature, example: AccountNature.ASSET })
  @IsEnum(AccountNature)
  nature: AccountNature;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
