import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { DriverMatchingService } from './driver-matching.service';
import { RideExpirationService } from './ride-expiration.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RidesController],
  providers: [RidesService, DriverMatchingService, RideExpirationService],
  exports: [RidesService],
})
export class RidesModule {}
