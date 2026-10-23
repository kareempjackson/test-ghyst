import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RidesService } from './rides.service';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { RideResponseDto } from './dto/ride-response.dto';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Get('active')
  async getActiveRide(
    @Query('userId') userId: string,
    @Query('role') role: 'RIDER' | 'DRIVER',
  ): Promise<RideResponseDto> {
    return this.ridesService.getActiveRide(userId, role);
  }

  @Get(':id')
  async getRide(@Param('id') id: string): Promise<RideResponseDto> {
    return this.ridesService.getRideById(id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptRide(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
  ): Promise<RideResponseDto> {
    return this.ridesService.acceptRide(id, driverId);
  }

  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  async arriveAtPickup(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
  ): Promise<RideResponseDto> {
    return this.ridesService.arriveAtPickup(id, driverId);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startRide(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
  ): Promise<RideResponseDto> {
    return this.ridesService.startRide(id, driverId);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeRide(
    @Param('id') id: string,
    @Query('driverId') driverId: string,
  ): Promise<RideResponseDto> {
    return this.ridesService.completeRide(id, driverId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelRide(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Query('role') role: 'RIDER' | 'DRIVER',
    @Body() cancelRideDto: CancelRideDto,
  ): Promise<RideResponseDto> {
    return this.ridesService.cancelRide(id, userId, role, cancelRideDto.reason);
  }
}
