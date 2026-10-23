import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from './fcm.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RegisterTokenDto } from './dto/register-token.dto';
import { RideNotificationDto } from './dto/ride-notification.dto';
import { NotificationType, NotificationStatus, Platform } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  async registerToken(userId: string, dto: RegisterTokenDto): Promise<void> {
    const existingToken = await this.prisma.fcmToken.findUnique({
      where: { token: dto.token },
    });

    if (existingToken) {
      if (existingToken.userId !== userId) {
        await this.prisma.fcmToken.update({
          where: { token: dto.token },
          data: { userId, isValid: true, platform: dto.platform },
        });
      } else if (!existingToken.isValid) {
        await this.prisma.fcmToken.update({
          where: { token: dto.token },
          data: { isValid: true },
        });
      }
      return;
    }

    await this.prisma.fcmToken.create({
      data: {
        token: dto.token,
        platform: dto.platform,
        userId,
      },
    });
  }

  async refreshToken(userId: string, oldToken: string, newToken: string, platform: Platform): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.fcmToken.updateMany({
        where: { token: oldToken },
        data: { isValid: false },
      });

      const existing = await tx.fcmToken.findUnique({
        where: { token: newToken },
      });

      if (existing) {
        await tx.fcmToken.update({
          where: { token: newToken },
          data: { userId, isValid: true, platform },
        });
      } else {
        await tx.fcmToken.create({
          data: { token: newToken, platform, userId },
        });
      }
    });
  }

  async sendNotification(dto: SendNotificationDto): Promise<{ success: boolean; notificationId: string }> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type || NotificationType.GENERAL,
        title: dto.title,
        body: dto.body,
        data: dto.data,
        status: NotificationStatus.PENDING,
      },
    });

    const tokens = await this.prisma.fcmToken.findMany({
      where: { userId: dto.userId, isValid: true },
      select: { token: true },
    });

    if (tokens.length === 0) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED, errorMsg: 'No valid FCM tokens' },
      });
      return { success: false, notificationId: notification.id };
    }

    const tokenStrings = tokens.map((t) => t.token);
    const result = await this.fcmService.sendMulticast(
      tokenStrings,
      dto.title,
      dto.body,
      dto.data,
    );

    if (result.invalidTokens.length > 0) {
      await this.invalidateTokens(result.invalidTokens);
    }

    const success = result.successCount > 0;
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        sentAt: success ? new Date() : null,
        errorMsg: success ? null : `Failed to send to all ${result.failureCount} tokens`,
      },
    });

    return { success, notificationId: notification.id };
  }

  async notifyRideRequested(dto: RideNotificationDto): Promise<void> {
    if (!dto.driverId) {
      this.logger.warn('notifyRideRequested called without driverId');
      return;
    }

    await this.sendNotification({
      userId: dto.driverId,
      title: 'New Ride Request',
      body: 'You have a new ride request. Tap to view details.',
      type: NotificationType.RIDE_REQUESTED,
      data: {
        rideId: dto.rideId,
        type: 'RIDE_REQUESTED',
        ...dto.additionalData,
      },
    });
  }

  async notifyRideAccepted(dto: RideNotificationDto): Promise<void> {
    await this.sendNotification({
      userId: dto.riderId,
      title: 'Ride Accepted',
      body: 'A driver has accepted your ride request!',
      type: NotificationType.RIDE_ACCEPTED,
      data: {
        rideId: dto.rideId,
        driverId: dto.driverId || '',
        type: 'RIDE_ACCEPTED',
        ...dto.additionalData,
      },
    });
  }

  async notifyDriverArriving(dto: RideNotificationDto): Promise<void> {
    await this.sendNotification({
      userId: dto.riderId,
      title: 'Driver Arriving',
      body: 'Your driver is arriving at the pickup location.',
      type: NotificationType.DRIVER_ARRIVING,
      data: {
        rideId: dto.rideId,
        type: 'DRIVER_ARRIVING',
        ...dto.additionalData,
      },
    });
  }

  async notifyRideStarted(dto: RideNotificationDto): Promise<void> {
    await this.sendNotification({
      userId: dto.riderId,
      title: 'Ride Started',
      body: 'Your ride has started. Enjoy your trip!',
      type: NotificationType.RIDE_STARTED,
      data: {
        rideId: dto.rideId,
        type: 'RIDE_STARTED',
        ...dto.additionalData,
      },
    });
  }

  async notifyRideCompleted(dto: RideNotificationDto): Promise<void> {
    await this.sendNotification({
      userId: dto.riderId,
      title: 'Ride Completed',
      body: 'Your ride has been completed. Thank you for riding with us!',
      type: NotificationType.RIDE_COMPLETED,
      data: {
        rideId: dto.rideId,
        type: 'RIDE_COMPLETED',
        ...dto.additionalData,
      },
    });
  }

  async notifyRideCancelled(dto: RideNotificationDto, cancelledBy: 'rider' | 'driver'): Promise<void> {
    const notifications: Promise<any>[] = [];

    if (cancelledBy === 'rider' && dto.driverId) {
      notifications.push(
        this.sendNotification({
          userId: dto.driverId,
          title: 'Ride Cancelled',
          body: 'The rider has cancelled the ride.',
          type: NotificationType.RIDE_CANCELLED,
          data: {
            rideId: dto.rideId,
            cancelledBy: 'rider',
            type: 'RIDE_CANCELLED',
            ...dto.additionalData,
          },
        }),
      );
    }

    if (cancelledBy === 'driver') {
      notifications.push(
        this.sendNotification({
          userId: dto.riderId,
          title: 'Ride Cancelled',
          body: 'Your driver has cancelled the ride. We are finding you another driver.',
          type: NotificationType.RIDE_CANCELLED,
          data: {
            rideId: dto.rideId,
            cancelledBy: 'driver',
            type: 'RIDE_CANCELLED',
            ...dto.additionalData,
          },
        }),
      );
    }

    await Promise.all(notifications);
  }

  async invalidateTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    await this.prisma.fcmToken.updateMany({
      where: { token: { in: tokens } },
      data: { isValid: false },
    });

    this.logger.log(`Invalidated ${tokens.length} FCM tokens`);
  }

  async cleanupInvalidTokens(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.fcmToken.deleteMany({
      where: {
        isValid: false,
        updatedAt: { lt: thirtyDaysAgo },
      },
    });

    this.logger.log(`Cleaned up ${result.count} invalid FCM tokens`);
    return result.count;
  }

  async getUserNotifications(userId: string, limit = 20, offset = 0) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
