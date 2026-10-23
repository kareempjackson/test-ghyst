import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export enum PaymentMethodDto {
  card = 'card',
  cash = 'cash',
}

export class CreateRideDto {
  @IsString()
  riderId: string;

  @IsNumber()
  pickupLat: number;

  @IsNumber()
  pickupLng: number;

  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @IsNumber()
  dropoffLat: number;

  @IsNumber()
  dropoffLng: number;

  @IsOptional()
  @IsString()
  dropoffAddress?: string;

  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto;

  @IsNumber()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
