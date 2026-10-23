import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmResult {
  success: boolean;
  messageId?: string;
  error?: string;
  invalidToken?: boolean;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('Firebase configuration incomplete. Push notifications will be disabled.');
      return;
    }

    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  async sendNotification(message: FcmMessage): Promise<FcmResult> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const fcmMessage: admin.messaging.Message = {
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'ride_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(fcmMessage);
      this.logger.debug(`Notification sent successfully: ${response}`);
      return { success: true, messageId: response };
    } catch (error: any) {
      const errorCode = error?.code || error?.errorInfo?.code;
      const isInvalidToken = [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
      ].includes(errorCode);

      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        invalidToken: isInvalidToken,
      };
    }
  }

  async sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
    if (!this.initialized || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'ride_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      const invalidTokens: string[] = [];

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error: any) {
      this.logger.error(`Multicast send failed: ${error.message}`);
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }
}
