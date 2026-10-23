import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}
