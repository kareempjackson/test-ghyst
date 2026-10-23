import { RideStatus } from '@prisma/client';

export class DriverInfoDto {
  id: string;
  firstName: string;
  lastName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehiclePlate: string;
  averageRating: number | null;
}

export class RideResponseDto {
  id: string;
  riderId: string;
  driverId: string | null;
  status: RideStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  estimatedFare: number | null;
  actualFare: number | null;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: Date | null;
  requestedAt: Date;
  acceptedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  driver: DriverInfoDto | null;
}
