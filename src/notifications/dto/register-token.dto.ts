import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { Platform } from '@prisma/client';

export class RegisterTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(Platform)
  platform: Platform;
}
