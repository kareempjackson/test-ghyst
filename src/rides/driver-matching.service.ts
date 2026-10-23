import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Driver, Prisma } from '@prisma/client';

type TransactionClient = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class DriverMatchingService {
  private readonly logger = new Logger(DriverMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findBestAvailableDriver(
    tx: TransactionClient,
    pickupZoneId: string,
    excludeDriverIds: string[] = [],
  ): Promise<Driver | null> {
    // First, try to find drivers in the same zone as pickup
    const driversInZone = await tx.driver.findMany({
      where: {
        isOnline: true,
        currentRideId: null,
        lastKnownZoneId: pickupZoneId,
        id: {
          notIn: excludeDriverIds.length > 0 ? excludeDriverIds : undefined,
        },
      },
      take: 1,
    });

    if (driversInZone.length > 0) {
      this.logger.log(`Found driver ${driversInZone[0].id} in pickup zone ${pickupZoneId}`);
      return driversInZone[0];
    }

    // If no drivers in zone, find nearest by zone distance
    const pickupZone = await tx.zone.findUnique({
      where: { id: pickupZoneId },
    });

    if (!pickupZone) {
      return null;
    }

    // Get all available drivers with their zones
    const availableDrivers = await tx.driver.findMany({
      where: {
        isOnline: true,
        currentRideId: null,
        lastKnownZoneId: { not: null },
        id: {
          notIn: excludeDriverIds.length > 0 ? excludeDriverIds : undefined,
        },
      },
      include: {
        lastKnownZone: true,
      },
    });

    if (availableDrivers.length === 0) {
      this.logger.log('No available drivers found');
      return null;
    }

    // Calculate distance to each driver's last known zone and sort
    const driversWithDistance = availableDrivers
      .filter((d) => d.lastKnownZone)
      .map((driver) => ({
        driver,
        distance: this.calculateDistance(
          pickupZone.latitude,
          pickupZone.longitude,
          driver.lastKnownZone!.latitude,
          driver.lastKnownZone!.longitude,
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (driversWithDistance.length === 0) {
      return null;
    }

    const nearest = driversWithDistance[0];
    this.logger.log(
      `Found nearest driver ${nearest.driver.id} at distance ${nearest.distance.toFixed(2)} km`,
    );

    return nearest.driver;
  }

  /**
   * Haversine formula to calculate distance between two coordinates in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
