import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TallySyncDirection } from '@prisma/client';

export class RunTallySyncDto {
  @ApiPropertyOptional({ enum: TallySyncDirection })
  @IsOptional()
  @IsEnum(TallySyncDirection)
  direction?: TallySyncDirection;
}
