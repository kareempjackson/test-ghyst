import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RegisterTokenDto } from './dto/register-token.dto';
import { Platform } from '@prisma/client';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('token/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerToken(
    @Param('userId') userId: string,
    @Body() dto: RegisterTokenDto,
  ): Promise<void> {
    await this.notificationsService.registerToken(userId, dto);
  }

  @Post('token/:userId/refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refreshToken(
    @Param('userId') userId: string,
    @Body() body: { oldToken: string; newToken: string; platform: Platform },
  ): Promise<void> {
    await this.notificationsService.refreshToken(
      userId,
      body.oldToken,
      body.newToken,
      body.platform,
    );
  }

  @Post('send')
  async sendNotification(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto);
  }

  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Post('cleanup')
  async cleanupInvalidTokens() {
    const count = await this.notificationsService.cleanupInvalidTokens();
    return { deletedCount: count };
  }
}
