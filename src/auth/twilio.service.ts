import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly client: Twilio;
  private readonly verifyServiceSid: string;
  private readonly logger = new Logger(TwilioService.name);

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>(
      'TWILIO_VERIFY_SERVICE_SID',
    );

    if (!accountSid || !authToken || !this.verifyServiceSid) {
      throw new Error('Twilio configuration is incomplete');
    }

    this.client = new Twilio(accountSid, authToken);
  }

  async sendVerification(phone: string): Promise<void> {
    try {
      await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: phone,
          channel: 'sms',
        });

      this.logger.log(`OTP sent to ${this.maskPhone(phone)}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP: ${error.message}`);
      throw new BadRequestException(
        'Failed to send verification code. Please check your phone number.',
      );
    }
  }

  async checkVerification(phone: string, code: string): Promise<boolean> {
    try {
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({
          to: phone,
          code,
        });

      return verification.status === 'approved';
    } catch (error) {
      this.logger.error(`Failed to verify OTP: ${error.message}`);
      return false;
    }
  }

  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  }
}
