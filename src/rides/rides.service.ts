import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriverMatchingService } from './driver-matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { Ride, RideStatus, PaymentMethod, DriverResponseStatus } from '@prisma/client';

const MAX_DRIVER_ATTEMPTS = 3;
const DRIVER_RESPONSE_TIMEOUT_SECONDS = 30;

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly driverMatchingService: DriverMatchingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRide(dto: CreateRideDto): Promise<Ride> {
    const rider = await this.prisma.rider.findUnique({
      where: { id: dto.rider_id },
    });
    if (!rider) {
      throw new NotFoundException(`Rider ${dto.rider_id} not found`);
    }

    const [pickupZone, dropoffZone] = await Promise.all([
      this.prisma.zone.findUnique({ where: { id: dto.pickup_zone_id } }),
      this.prisma.zone.findUnique({ where: { id: dto.dropoff_zone_id } }),
    ]);

    if (!pickupZone) {
      throw new NotFoundException(`Pickup zone ${dto.pickup_zone_id} not found`);
    }
    if (!dropoffZone) {
      throw new NotFoundException(`Dropoff zone ${dto.dropoff_zone_id} not found`);
    }

    const ride = await this.prisma.ride.create({
      data: {
        riderId: dto.rider_id,
        pickupZoneId: dto.pickup_zone_id,
        dropoffZoneId: dto.dropoff_zone_id,
        paymentMethod: dto.payment_method as PaymentMethod,
        status: RideStatus.requested,
        driversAttempted: 0,
      },
      include: {
        pickupZone: true,
        dropoffZone: true,
      },
    });

    this.logger.log(`Ride ${ride.id} created, starting driver matching`);

    // Start async driver matching process
    this.matchNextDriver(ride.id).catch((err) => {
      this.logger.error(`Error in driver matching for ride ${ride.id}: ${err.message}`);
    });

    return ride;
  }

  async matchNextDriver(rideId: string): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the ride row for update
      const rides = await tx.$queryRaw<Ride[]>`
        SELECT * FROM "Ride" WHERE id = ${rideId}::uuid FOR UPDATE
      `;
      
      const ride = rides[0];
      if (!ride) {
        throw new NotFoundException(`Ride ${rideId} not found`);
      }

      if (ride.status !== RideStatus.requested) {
        this.logger.log(`Ride ${rideId} is no longer in requested status, skipping matching`);
        return null;
      }

      if (ride.driversAttempted >= MAX_DRIVER_ATTEMPTS) {
        await tx.ride.update({
          where: { id: rideId },
          data: { status: RideStatus.no_drivers },
        });
        this.logger.log(`Ride ${rideId} marked as no_drivers after ${MAX_DRIVER_ATTEMPTS} attempts`);
        return null;
      }

      // Get already attempted driver IDs
      const attemptedRequests = await tx.rideDriverRequest.findMany({
        where: { rideId },
        select: { driverId: true },
      });
      const attemptedDriverIds = attemptedRequests.map((r) => r.driverId);

      // Find next available driver
      const driver = await this.driverMatchingService.findBestAvailableDriver(
        tx,
        ride.pickupZoneId,
        attemptedDriverIds,
      );

      if (!driver) {
        await tx.ride.update({
          where: { id: rideId },
          data: { status: RideStatus.no_drivers },
        });
        this.logger.log(`Ride ${rideId} marked as no_drivers - no available drivers`);
        return null;
      }

      const expiresAt = new Date(Date.now() + DRIVER_RESPONSE_TIMEOUT_SECONDS * 1000);

      // Create driver request record
      await tx.rideDriverRequest.create({
        data: {
          rideId,
          driverId: driver.id,
          status: DriverResponseStatus.pending,
          expiresAt,
        },
      });

      // Increment attempts counter
      await tx.ride.update({
        where: { id: rideId },
        data: { driversAttempted: { increment: 1 } },
      });

      return { driver, expiresAt, rideId };
    });

    if (result) {
      const { driver, rideId } = result;
      
      // Fetch ride with zones for notification
      const rideWithZones = await this.prisma.ride.findUnique({
        where: { id: rideId },
        include: { pickupZone: true, dropoffZone: true },
      });

      if (driver.pushToken && rideWithZones) {
        await this.notificationsService.sendRideRequestNotification(
          driver.pushToken,
          rideId,
          rideWithZones.pickupZone.name,
          rideWithZones.dropoffZone.name,
        );
        this.logger.log(`Push notification sent to driver ${driver.id} for ride ${rideId}`);
      }
    }
  }

  async acceptRide(rideId: string, driverId: string): Promise<Ride> {
    return this.prisma.$transaction(async (tx) => {
      // Lock both ride and driver rows
      const rides = await tx.$queryRaw<Ride[]>`
        SELECT * FROM "Ride" WHERE id = ${rideId}::uuid FOR UPDATE
      `;
      const ride = rides[0];

      if (!ride) {
        throw new NotFoundException(`Ride ${rideId} not found`);
      }

      if (ride.status !== RideStatus.requested) {
        throw new ConflictException(`Ride ${rideId} is not in requested status`);
      }

      const request = await tx.rideDriverRequest.findUnique({
        where: {
          rideId_driverId: { rideId, driverId },
        },
      });

      if (!request) {
        throw new BadRequestException(`No pending request found for driver ${driverId} on ride ${rideId}`);
      }

      if (request.status !== DriverResponseStatus.pending) {
        throw new ConflictException(`Request already processed with status: ${request.status}`);
      }

      if (new Date() > request.expiresAt) {
        throw new ConflictException(`Request has expired`);
      }

      // Check driver is still available
      const drivers = await tx.$queryRaw<any[]>`
        SELECT * FROM "Driver" WHERE id = ${driverId}::uuid FOR UPDATE
      `;
      const driver = drivers[0];

      if (!driver) {
        throw new NotFoundException(`Driver ${driverId} not found`);
      }

      if (!driver.isOnline || driver.currentRideId) {
        throw new ConflictException(`Driver ${driverId} is no longer available`);
      }

      // Update request status
      await tx.rideDriverRequest.update({
        where: { id: request.id },
        data: { status: DriverResponseStatus.accepted },
      });

      // Update ride
      const updatedRide = await tx.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.driver_assigned,
          assignedDriverId: driverId,
        },
      });

      // Update driver's current ride
      await tx.driver.update({
        where: { id: driverId },
        data: { currentRideId: rideId },
      });

      this.logger.log(`Ride ${rideId} accepted by driver ${driverId}`);

      return updatedRide;
    });
  }

  async declineRide(rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.prisma.$transaction(async (tx) => {
      const rides = await tx.$queryRaw<Ride[]>`
        SELECT * FROM "Ride" WHERE id = ${rideId}::uuid FOR UPDATE
      `;
      const ride = rides[0];

      if (!ride) {
        throw new NotFoundException(`Ride ${rideId} not found`);
      }

      if (ride.status !== RideStatus.requested) {
        throw new ConflictException(`Ride ${rideId} is not in requested status`);
      }

      const request = await tx.rideDriverRequest.findUnique({
        where: {
          rideId_driverId: { rideId, driverId },
        },
      });

      if (!request) {
        throw new BadRequestException(`No pending request found for driver ${driverId} on ride ${rideId}`);
      }

      if (request.status !== DriverResponseStatus.pending) {
        throw new ConflictException(`Request already processed with status: ${request.status}`);
      }

      await tx.rideDriverRequest.update({
        where: { id: request.id },
        data: { status: DriverResponseStatus.declined },
      });

      this.logger.log(`Ride ${rideId} declined by driver ${driverId}`);

      return ride;
    });

    // Try to match next driver
    await this.matchNextDriver(rideId);

    // Return updated ride
    return this.prisma.ride.findUniqueOrThrow({ where: { id: rideId } });
  }

  async expireDriverRequest(rideId: string, driverId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const request = await tx.rideDriverRequest.findUnique({
          where: {
            rideId_driverId: { rideId, driverId },
          },
        });

        if (!request || request.status !== DriverResponseStatus.pending) {
          return;
        }

        await tx.rideDriverRequest.update({
          where: { id: request.id },
          data: { status: DriverResponseStatus.expired },
        });

        this.logger.log(`Request for driver ${driverId} on ride ${rideId} expired`);
      });

      // Try to match next driver
      await this.matchNextDriver(rideId);
    } catch (error) {
      this.logger.error(`Error expiring request: ${error.message}`);
    }
  }
}
