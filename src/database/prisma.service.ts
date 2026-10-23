import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      const models = Reflect.ownKeys(this).filter(
        (key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$')
      );

      for (const model of models) {
        const modelDelegate = this[model as keyof this];
        if (modelDelegate && typeof (modelDelegate as any).deleteMany === 'function') {
          await (modelDelegate as any).deleteMany();
        }
      }
    }
  }
}
