import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  private readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:otp:';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    
    this.client = createClient({ url: redisUrl });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
    });

    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async setRefreshToken(
    token: string,
    userId: string,
    expirySeconds: number,
  ): Promise<void> {
    await this.client.setEx(
      `${this.REFRESH_TOKEN_PREFIX}${token}`,
      expirySeconds,
      userId,
    );
  }

  async getRefreshToken(token: string): Promise<string | null> {
    return this.client.get(`${this.REFRESH_TOKEN_PREFIX}${token}`);
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.client.del(`${this.REFRESH_TOKEN_PREFIX}${token}`);
  }

  async checkRateLimit(phone: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `${this.RATE_LIMIT_PREFIX}${phone}`;
    const windowSeconds = 10 * 60; // 10 minutes
    const maxRequests = 3;

    const current = await this.client.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    const multi = this.client.multi();
    multi.incr(key);
    
    if (count === 0) {
      multi.expire(key, windowSeconds);
    }
    
    await multi.exec();

    return { allowed: true, remaining: maxRequests - count - 1 };
  }

  async getRateLimitTTL(phone: string): Promise<number> {
    const key = `${this.RATE_LIMIT_PREFIX}${phone}`;
    return this.client.ttl(key);
  }
}
