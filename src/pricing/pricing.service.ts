import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesService } from '../zones/zones.service';
import { PricingEstimateDto } from './dto/pricing-estimate.dto';
import { PricingResponseDto } from './dto/pricing-response.dto';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonesService: ZonesService,
  ) {}

  async getEstimate(dto: PricingEstimateDto): Promise<PricingResponseDto> {
    const { from_zone_id, to_zone_id } = dto;

    // Validate zones exist
    const [fromZone, toZone] = await Promise.all([
      this.zonesService.findById(from_zone_id),
      this.zonesService.findById(to_zone_id),
    ]);

    if (!fromZone) {
      throw new NotFoundException(`Origin zone with ID '${from_zone_id}' not found`);
    }

    if (!toZone) {
      throw new NotFoundException(`Destination zone with ID '${to_zone_id}' not found`);
    }

    // Find pricing
    const pricing = await this.prisma.pricing.findUnique({
      where: {
        fromZoneId_toZoneId: {
          fromZoneId: from_zone_id,
          toZoneId: to_zone_id,
        },
      },
    });

    if (!pricing || !pricing.isActive) {
      throw new BadRequestException(
        `No pricing available for route from '${fromZone.name}' to '${toZone.name}'`,
      );
    }

    return {
      from_zone: {
        id: fromZone.id,
        name: fromZone.name,
      },
      to_zone: {
        id: toZone.id,
        name: toZone.name,
      },
      fare_cents: pricing.fareCents,
      currency: pricing.currency,
      fare_display: this.formatFare(pricing.fareCents, pricing.currency),
    };
  }

  private formatFare(cents: number, currency: string): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(dollars);
  }
}
