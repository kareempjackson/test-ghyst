import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    PrismaModule,
    RidesModule,
    NotificationsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
