import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService, RideRequestParams } from './payments.service';
import { PaymentMethod } from '@prisma/client';

export class CreateRideDto {
  riderId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress?: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress?: string;
  paymentMethod: 'card' | 'cash';
  amountCents: number;
  currency?: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('rides')
  @HttpCode(HttpStatus.CREATED)
  async createRideWithPayment(@Body() dto: CreateRideDto) {
    const params: RideRequestParams = {
      ...dto,
      paymentMethod: dto.paymentMethod === 'card' ? PaymentMethod.card : PaymentMethod.cash,
    };
    return this.paymentsService.createRideWithPayment(params);
  }

  @Post('rides/:rideId/complete')
  @HttpCode(HttpStatus.OK)
  async completeRide(@Param('rideId') rideId: string) {
    return this.paymentsService.capturePaymentOnRideComplete(rideId);
  }
}
