import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ZonesModule } from './zones/zones.module';
import { PricingModule } from './pricing/pricing.module';

@Module({
  imports: [PrismaModule, ZonesModule, PricingModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
