import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { ZoneResponseDto } from './dto/zone-response.dto';

@ApiTags('zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active zones for pickup/dropoff selection' })
  @ApiResponse({
    status: 200,
    description: 'List of all active zones',
    type: [ZoneResponseDto],
  })
  async findAll(): Promise<ZoneResponseDto[]> {
    return this.zonesService.findAll();
  }
}
