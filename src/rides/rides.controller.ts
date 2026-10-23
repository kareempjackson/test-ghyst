import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { RideResponseDto, toRideResponse } from './dto/ride-response.dto';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRide(@Body() createRideDto: CreateRideDto): Promise<RideResponseDto> {
    const ride = await this.ridesService.createRide(createRideDto);
    return toRideResponse(ride);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptRide(
    @Param('id', ParseUUIDPipe) rideId: string,
    @Body('driver_id', ParseUUIDPipe) driverId: string,
  ): Promise<RideResponseDto> {
    const ride = await this.ridesService.acceptRide(rideId, driverId);
    return toRideResponse(ride);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  async declineRide(
    @Param('id', ParseUUIDPipe) rideId: string,
    @Body('driver_id', ParseUUIDPipe) driverId: string,
  ): Promise<RideResponseDto> {
    const ride = await this.ridesService.declineRide(rideId, driverId);
    return toRideResponse(ride);
  }
}
