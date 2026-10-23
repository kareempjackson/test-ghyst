import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const phone = request.body?.phone;

    if (!phone) {
      return true;
    }

    const normalizedPhone = this.normalizePhone(phone);
    const { allowed, remaining } = await this.redisService.checkRateLimit(normalizedPhone);

    if (!allowed) {
      const ttl = await this.redisService.getRateLimitTTL(normalizedPhone);
      const minutes = Math.ceil(ttl / 60);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many OTP requests. Please try again in ${minutes} minute(s).`,
          error: 'Too Many Requests',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    request.rateLimitRemaining = remaining;
    return true;
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
