import { IsString, IsUUID, IsEnum } from 'class-validator';

export enum PaymentMethodDto {
  cash = 'cash',
  card = 'card',
  wallet = 'wallet',
}

export class CreateRideDto {
  @IsUUID()
  rider_id: string;

  @IsUUID()
  pickup_zone_id: string;

  @IsUUID()
  dropoff_zone_id: string;

  @IsEnum(PaymentMethodDto)
  payment_method: PaymentMethodDto;
}
