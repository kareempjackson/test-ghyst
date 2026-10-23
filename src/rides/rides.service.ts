import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RateRideDto } from './dto/rate-ride.dto';
import { RideResponseDto, DriverInfoDto } from './dto/ride-response.dto';
import { Ride, RideStatus } from '@prisma/client';

const MINIMUM_RIDES_FOR_BLOCKING = 10;
const MINIMUM_RATING_THRESHOLD = 3.5;

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async rateRide(
    rideId: string,
    userId: string,
    dto: RateRideDto,
  ): Promise<RideResponseDto> {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.riderId !== userId) {
      throw new ForbiddenException('Only the rider can rate this ride');
    }

    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed rides');
    }

    if (ride.rating !== null) {
      throw new BadRequestException('This ride has already been rated');
    }

    if (!ride.driverId || !ride.driver?.driverProfile) {
      throw new BadRequestException('No driver assigned to this ride');
    }

    const driverProfile = ride.driver.driverProfile;

    // Calculate new average rating
    const currentTotalRatings = driverProfile.totalRatings;
    const currentAverage = driverProfile.averageRating || 0;
    const newTotalRatings = currentTotalRatings + 1;
    const newAverageRating =
      (currentAverage * currentTotalRatings + dto.rating) / newTotalRatings;

    // Check if driver should be blocked
    const totalCompletedRides = driverProfile.totalRides + 1;
    const shouldBlock =
      totalCompletedRides >= MINIMUM_RIDES_FOR_BLOCKING &&
      newAverageRating < MINIMUM_RATING_THRESHOLD;

    // Use transaction to update ride and driver profile atomically
    const [updatedRide] = await this.prisma.$transaction([
      this.prisma.ride.update({
        where: { id: rideId },
        data: {
          rating: dto.rating,
          ratingComment: dto.comment || null,
          ratedAt: new Date(),
        },
        include: {
          driver: {
            include: {
              driverProfile: true,
            },
          },
        },
      }),
      this.prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          averageRating: Math.round(newAverageRating * 100) / 100,
          totalRatings: newTotalRatings,
          totalRides: totalCompletedRides,
          isBlocked: shouldBlock,
        },
      }),
    ]);

    return this.mapToRideResponse(updatedRide);
  }

  async getRideById(rideId: string, userId: string): Promise<RideResponseDto> {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    // Allow access if user is the rider or the driver
    if (ride.riderId !== userId && ride.driverId !== userId) {
      throw new ForbiddenException('Access denied to this ride');
    }

    return this.mapToRideResponse(ride);
  }

  async isDriverEligible(driverId: string): Promise<boolean> {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverId },
    });

    if (!driverProfile) {
      return false;
    }

    // Driver is eligible if not blocked and available
    return !driverProfile.isBlocked && driverProfile.isAvailable;
  }

  private mapToRideResponse(ride: any): RideResponseDto {
    let driverInfo: DriverInfoDto | null = null;

    if (ride.driver && ride.driver.driverProfile) {
      driverInfo = {
        id: ride.driver.id,
        firstName: ride.driver.firstName,
        lastName: ride.driver.lastName,
        vehicleMake: ride.driver.driverProfile.vehicleMake,
        vehicleModel: ride.driver.driverProfile.vehicleModel,
        vehicleColor: ride.driver.driverProfile.vehicleColor,
        vehiclePlate: ride.driver.driverProfile.vehiclePlate,
        averageRating: ride.driver.driverProfile.averageRating,
      };
    }

    return {
      id: ride.id,
      riderId: ride.riderId,
      driverId: ride.driverId,
      status: ride.status,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      pickupAddress: ride.pickupAddress,
      dropoffLat: ride.dropoffLat,
      dropoffLng: ride.dropoffLng,
      dropoffAddress: ride.dropoffAddress,
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      rating: ride.rating,
      ratingComment: ride.ratingComment,
      ratedAt: ride.ratedAt,
      requestedAt: ride.requestedAt,
      acceptedAt: ride.acceptedAt,
      startedAt: ride.startedAt,
      completedAt: ride.completedAt,
      driver: driverInfo,
    };
  }
}
