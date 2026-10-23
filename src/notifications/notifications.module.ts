import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FcmService } from './fcm.service';
import { PrismaModule } from '../prisma/prisma.module';
import firebaseConfig from '../config/firebase.config';

@Module({
  imports: [
    ConfigModule.forFeature(firebaseConfig),
    PrismaModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
