import { RideStatus, PaymentMethod } from '@prisma/client';

export class RideResponseDto {
  id: string;
  rider_id: string;
  pickup_zone_id: string;
  dropoff_zone_id: string;
  payment_method: PaymentMethod;
  status: RideStatus;
  assigned_driver_id: string | null;
  drivers_attempted: number;
  created_at: Date;
  updated_at: Date;
}

export function toRideResponse(ride: any): RideResponseDto {
  return {
    id: ride.id,
    rider_id: ride.riderId,
    pickup_zone_id: ride.pickupZoneId,
    dropoff_zone_id: ride.dropoffZoneId,
    payment_method: ride.paymentMethod,
    status: ride.status,
    assigned_driver_id: ride.assignedDriverId,
    drivers_attempted: ride.driversAttempted,
    created_at: ride.createdAt,
    updated_at: ride.updatedAt,
  };
}
