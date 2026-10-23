import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RidesModule } from './rides/rides.module';

@Module({
  imports: [PrismaModule, RidesModule],
})
export class AppModule {}
