import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { RideStatus, PaymentMethod, PaymentStatus, Ride, User } from '@prisma/client';
import {
  RideNotFoundException,
  InvalidRideStateTransitionException,
  UnauthorizedRideActionException,
  NoActiveRideException,
  RideAlreadyAcceptedException,
} from '../common/exceptions/ride.exceptions';
import {
  RIDE_STATUS_TRANSITIONS,
  ACTIVE_RIDE_STATUSES,
} from '../common/enums/ride-status.enum';
import { RideResponseDto } from './dto/ride-response.dto';

type RideWithRelations = Ride & {
  rider: User;
  driver: (User & { driverProfile: { vehicleMake: string; vehicleModel: string; vehicleColor: string; licensePlate: string } | null }) | null;
};

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
  ) {}

  private validateStateTransition(currentStatus: RideStatus, targetStatus: RideStatus): void {
    const allowedTransitions = RIDE_STATUS_TRANSITIONS[currentStatus as keyof typeof RIDE_STATUS_TRANSITIONS] || [];
    if (!allowedTransitions.includes(targetStatus as any)) {
      throw new InvalidRideStateTransitionException(currentStatus, targetStatus);
    }
  }

  private mapToResponseDto(ride: RideWithRelations): RideResponseDto {
    return {
      id: ride.id,
      status: ride.status,
      pickup: {
        lat: ride.pickupLat,
        lng: ride.pickupLng,
        address: ride.pickupAddress,
      },
      dropoff: {
        lat: ride.dropoffLat,
        lng: ride.dropoffLng,
        address: ride.dropoffAddress,
      },
      estimatedFare: ride.estimatedFare,
      actualFare: ride.actualFare,
      distanceKm: ride.distanceKm,
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      rider: {
        id: ride.rider.id,
        firstName: ride.rider.firstName,
        lastName: ride.rider.lastName,
        phone: ride.rider.phone,
      },
      driver: ride.driver
        ? {
            id: ride.driver.id,
            firstName: ride.driver.firstName,
            lastName: ride.driver.lastName,
            phone: ride.driver.phone,
            vehicleMake: ride.driver.driverProfile?.vehicleMake,
            vehicleModel: ride.driver.driverProfile?.vehicleModel,
            vehicleColor: ride.driver.driverProfile?.vehicleColor,
            licensePlate: ride.driver.driverProfile?.licensePlate,
          }
        : null,
      requestedAt: ride.requestedAt,
      acceptedAt: ride.acceptedAt,
      driverArrivedAt: ride.driverArrivedAt,
      startedAt: ride.startedAt,
      completedAt: ride.completedAt,
      cancelledAt: ride.cancelledAt,
      cancellationReason: ride.cancellationReason,
      cancelledBy: ride.cancelledBy,
    };
  }

  private async getRideWithRelations(rideId: string): Promise<RideWithRelations> {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    if (!ride) {
      throw new RideNotFoundException(rideId);
    }

    return ride as RideWithRelations;
  }

  async getRideById(rideId: string): Promise<RideResponseDto> {
    const ride = await this.getRideWithRelations(rideId);
    return this.mapToResponseDto(ride);
  }

  async getActiveRide(userId: string, userRole: 'RIDER' | 'DRIVER'): Promise<RideResponseDto> {
    const whereClause = userRole === 'RIDER'
      ? { riderId: userId, status: { in: ACTIVE_RIDE_STATUSES } }
      : { driverId: userId, status: { in: ACTIVE_RIDE_STATUSES } };

    const ride = await this.prisma.ride.findFirst({
      where: whereClause,
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!ride) {
      throw new NoActiveRideException();
    }

    return this.mapToResponseDto(ride as RideWithRelations);
  }

  async acceptRide(rideId: string, driverId: string): Promise<RideResponseDto> {
    const ride = await this.getRideWithRelations(rideId);

    if (ride.driverId && ride.driverId !== driverId) {
      throw new RideAlreadyAcceptedException();
    }

    this.validateStateTransition(ride.status, RideStatus.ACCEPTED);

    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });

    if (!driver || driver.role !== 'DRIVER') {
      throw new UnauthorizedRideActionException('accept');
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.ACCEPTED,
        driverId,
        acceptedAt: new Date(),
      },
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    await this.notifications.notifyRideAccepted(
      ride.riderId,
      `${driver.firstName} ${driver.lastName}`,
      rideId,
    );

    this.logger.log(`Ride ${rideId} accepted by driver ${driverId}`);

    return this.mapToResponseDto(updatedRide as RideWithRelations);
  }

  async arriveAtPickup(rideId: string, driverId: string): Promise<RideResponseDto> {
    const ride = await this.getRideWithRelations(rideId);

    if (ride.driverId !== driverId) {
      throw new UnauthorizedRideActionException('mark arrival for');
    }

    this.validateStateTransition(ride.status, RideStatus.DRIVER_ARRIVED);

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.DRIVER_ARRIVED,
        driverArrivedAt: new Date(),
      },
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    await this.notifications.notifyDriverArrived(ride.riderId, rideId);

    this.logger.log(`Driver ${driverId} arrived at pickup for ride ${rideId}`);

    return this.mapToResponseDto(updatedRide as RideWithRelations);
  }

  async startRide(rideId: string, driverId: string): Promise<RideResponseDto> {
    const ride = await this.getRideWithRelations(rideId);

    if (ride.driverId !== driverId) {
      throw new UnauthorizedRideActionException('start');
    }

    this.validateStateTransition(ride.status, RideStatus.IN_PROGRESS);

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    await this.notifications.notifyRideStarted(ride.riderId, rideId);

    this.logger.log(`Ride ${rideId} started by driver ${driverId}`);

    return this.mapToResponseDto(updatedRide as RideWithRelations);
  }

  async completeRide(rideId: string, driverId: string): Promise<RideResponseDto> {
    const ride = await this.getRideWithRelations(rideId);

    if (ride.driverId !== driverId) {
      throw new UnauthorizedRideActionException('complete');
    }

    this.validateStateTransition(ride.status, RideStatus.COMPLETED);

    const actualFare = ride.estimatedFare; // In production, calculate based on actual distance/time
    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;

    if (ride.paymentMethod === PaymentMethod.CARD && ride.paymentIntentId) {
      const paymentResult = await this.payments.capturePayment(
        ride.paymentIntentId,
        actualFare,
      );
      paymentStatus = paymentResult.success
        ? PaymentStatus.CAPTURED
        : PaymentStatus.FAILED;
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.COMPLETED,
        completedAt: new Date(),
        actualFare,
        paymentStatus,
      },
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    await this.notifications.notifyRideCompleted(ride.riderId, actualFare, rideId);

    this.logger.log(`Ride ${rideId} completed by driver ${driverId}`);

    return this.mapToResponseDto(updatedRide as RideWithRelations);
  }

  async cancelRide(
    rideId: string,
    userId: string,
    userRole: 'RIDER' | 'DRIVER',
    reason: string,
  ): Promise<RideResponseDto> {
    const ride = await this.getRideWithRelations(rideId);

    const isRider = ride.riderId === userId;
    const isDriver = ride.driverId === userId;

    if (!isRider && !isDriver) {
      throw new UnauthorizedRideActionException('cancel');
    }

    this.validateStateTransition(ride.status, RideStatus.CANCELLED);

    const cancelledBy = isRider ? 'rider' : 'driver';

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy,
      },
      include: {
        rider: true,
        driver: {
          include: {
            driverProfile: true,
          },
        },
      },
    });

    // Notify the other party
    const notifyUserId = isRider ? ride.driverId : ride.riderId;
    if (notifyUserId) {
      await this.notifications.notifyRideCancelled(
        notifyUserId,
        cancelledBy,
        reason,
        rideId,
      );
    }

    this.logger.log(`Ride ${rideId} cancelled by ${cancelledBy}: ${reason}`);

    return this.mapToResponseDto(updatedRide as RideWithRelations);
  }
}
