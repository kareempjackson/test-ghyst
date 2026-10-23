import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZoneResponseDto } from './dto/zone-response.dto';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ZoneResponseDto[]> {
    const zones = await this.prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return zones;
  }

  async findById(id: string): Promise<ZoneResponseDto | null> {
    const zone = await this.prisma.zone.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return zone;
  }
}
