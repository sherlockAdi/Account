import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Ravi Sharma' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'ravi@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: ['branch_accountant'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}
