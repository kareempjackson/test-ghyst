import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RidesService } from './rides.service';
import { DriverResponseStatus, RideStatus } from '@prisma/client';

@Injectable()
export class RideExpirationService {
  private readonly logger = new Logger(RideExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesService: RidesService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleExpiredRequests(): Promise<void> {
    const now = new Date();

    // Find all expired pending requests
    const expiredRequests = await this.prisma.rideDriverRequest.findMany({
      where: {
        status: DriverResponseStatus.pending,
        expiresAt: { lt: now },
      },
      include: {
        ride: true,
      },
    });

    for (const request of expiredRequests) {
      // Only process if ride is still in requested status
      if (request.ride.status === RideStatus.requested) {
        this.logger.log(
          `Processing expired request for driver ${request.driverId} on ride ${request.rideId}`,
        );
        
        await this.ridesService.expireDriverRequest(
          request.rideId,
          request.driverId,
        );
      } else {
        // Just mark as expired without trying to match next driver
        await this.prisma.rideDriverRequest.update({
          where: { id: request.id },
          data: { status: DriverResponseStatus.expired },
        });
      }
    }
  }
}
