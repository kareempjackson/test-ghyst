import { Injectable, Logger } from '@nestjs/common';

export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPushNotification(notification: PushNotification): Promise<void> {
    // In production, integrate with FCM, APNs, or OneSignal
    this.logger.log(
      `Sending push notification to user ${notification.userId}: ${notification.title}`,
    );
    this.logger.debug(`Notification body: ${notification.body}`);
    this.logger.debug(`Notification data: ${JSON.stringify(notification.data)}`);
    
    // Simulate async operation
    await Promise.resolve();
  }

  async notifyRideAccepted(riderId: string, driverName: string, rideId: string): Promise<void> {
    await this.sendPushNotification({
      userId: riderId,
      title: 'Ride Accepted!',
      body: `${driverName} has accepted your ride request`,
      data: { rideId, type: 'RIDE_ACCEPTED' },
    });
  }

  async notifyDriverArrived(riderId: string, rideId: string): Promise<void> {
    await this.sendPushNotification({
      userId: riderId,
      title: 'Driver Arrived',
      body: 'Your driver has arrived at the pickup location',
      data: { rideId, type: 'DRIVER_ARRIVED' },
    });
  }

  async notifyRideStarted(riderId: string, rideId: string): Promise<void> {
    await this.sendPushNotification({
      userId: riderId,
      title: 'Ride Started',
      body: 'Your ride has started. Enjoy your trip!',
      data: { rideId, type: 'RIDE_STARTED' },
    });
  }

  async notifyRideCompleted(riderId: string, fare: number, rideId: string): Promise<void> {
    await this.sendPushNotification({
      userId: riderId,
      title: 'Ride Completed',
      body: `Your ride is complete. Total fare: $${fare.toFixed(2)}`,
      data: { rideId, type: 'RIDE_COMPLETED' },
    });
  }

  async notifyRideCancelled(
    userId: string,
    cancelledBy: string,
    reason: string,
    rideId: string,
  ): Promise<void> {
    await this.sendPushNotification({
      userId,
      title: 'Ride Cancelled',
      body: `Ride cancelled by ${cancelledBy}. Reason: ${reason}`,
      data: { rideId, type: 'RIDE_CANCELLED' },
    });
  }
}
