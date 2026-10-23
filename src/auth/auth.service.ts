import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from './twilio.service';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  user_id: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    role: UserRole;
    isNewUser: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;

  constructor(
    private readonly twilioService: TwilioService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    const normalizedPhone = this.normalizePhone(phone);
    await this.twilioService.sendVerification(normalizedPhone);
  }

  async verifyOtp(phone: string, code: string): Promise<AuthTokens> {
    const normalizedPhone = this.normalizePhone(phone);

    const isValid = await this.twilioService.checkVerification(
      normalizedPhone,
      code,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const { user, isNewUser } = await this.findOrCreateUser(normalizedPhone);

    const tokens = await this.generateTokens(user.id, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        isNewUser,
      },
    };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<Omit<AuthTokens, 'user'>> {
    const userId = await this.redisService.getRefreshToken(refreshToken);

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.redisService.deleteRefreshToken(refreshToken);

    return this.generateTokens(user.id, user.role);
  }

  private async findOrCreateUser(
    phone: string,
  ): Promise<{ user: { id: string; phone: string; role: UserRole }; isNewUser: boolean }> {
    let user = await this.prismaService.user.findUnique({
      where: { phone },
    });

    let isNewUser = false;

    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          phone,
          role: UserRole.RIDER,
        },
      });
      isNewUser = true;
    }

    return { user, isNewUser };
  }

  private async generateTokens(
    userId: string,
    role: UserRole,
  ): Promise<Omit<AuthTokens, 'user'>> {
    const payload: JwtPayload = {
      user_id: userId,
      role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();

    await this.redisService.setRefreshToken(
      refreshToken,
      userId,
      this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+1' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }
}
