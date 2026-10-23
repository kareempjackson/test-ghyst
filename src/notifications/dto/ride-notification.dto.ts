import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class RideNotificationDto {
  @IsString()
  @IsNotEmpty()
  rideId: string;

  @IsString()
  @IsNotEmpty()
  riderId: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsObject()
  @IsOptional()
  additionalData?: Record<string, string>;
}
