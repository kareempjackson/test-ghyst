import { RideStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

export class RideLocationDto {
  lat: number;
  lng: number;
  address: string;
}

export class RideDriverDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
}

export class RideRiderDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export class RideResponseDto {
  id: string;
  status: RideStatus;
  pickup: RideLocationDto;
  dropoff: RideLocationDto;
  estimatedFare: number;
  actualFare: number | null;
  distanceKm: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  rider: RideRiderDto;
  driver: RideDriverDto | null;
  requestedAt: Date;
  acceptedAt: Date | null;
  driverArrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
}
