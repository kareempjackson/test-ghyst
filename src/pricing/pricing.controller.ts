import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { PricingEstimateDto } from './dto/pricing-estimate.dto';
import { PricingResponseDto } from './dto/pricing-response.dto';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('estimate')
  @ApiOperation({ summary: 'Get fare estimate between two zones' })
  @ApiQuery({ name: 'from_zone_id', description: 'Origin zone ID', required: true })
  @ApiQuery({ name: 'to_zone_id', description: 'Destination zone ID', required: true })
  @ApiResponse({
    status: 200,
    description: 'Fare estimate for the route',
    type: PricingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  @ApiResponse({ status: 400, description: 'No pricing available for route' })
  async getEstimate(@Query() dto: PricingEstimateDto): Promise<PricingResponseDto> {
    return this.pricingService.getEstimate(dto);
  }
}
