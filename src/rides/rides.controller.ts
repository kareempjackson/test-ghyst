import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RidesService } from './rides.service';
import { RateRideDto } from './dto/rate-ride.dto';
import { RideResponseDto } from './dto/ride-response.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/guards/auth.guard';

@Controller('rides')
@UseGuards(AuthGuard)
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  async rateRide(
    @Param('id', ParseUUIDPipe) rideId: string,
    @Body() dto: RateRideDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RideResponseDto> {
    return this.ridesService.rateRide(rideId, user.id, dto);
  }

  @Get(':id')
  async getRide(
    @Param('id', ParseUUIDPipe) rideId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RideResponseDto> {
    return this.ridesService.getRideById(rideId, user.id);
  }
}
