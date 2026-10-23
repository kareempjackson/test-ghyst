import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';

export interface CreatePaymentIntentParams {
  rideId: string;
  amountCents: number;
  currency?: string;
  customerId?: string;
}

export interface RideRequestParams {
  riderId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress?: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress?: string;
  paymentMethod: PaymentMethod;
  amountCents: number;
  currency?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured');
    }
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2023-10-16',
    });
  }

  async createRideWithPayment(params: RideRequestParams) {
    const { paymentMethod, amountCents, currency = 'usd', ...rideData } = params;

    if (paymentMethod === PaymentMethod.cash) {
      const ride = await this.prisma.ride.create({
        data: {
          ...rideData,
          paymentMethod: PaymentMethod.cash,
          paymentStatus: PaymentStatus.cash,
          amountCents,
          currency,
        },
      });
      this.logger.log(`Created cash ride ${ride.id}`);
      return ride;
    }

    if (paymentMethod === PaymentMethod.card) {
      if (!amountCents || amountCents <= 0) {
        throw new BadRequestException('Amount is required for card payments');
      }

      const ride = await this.prisma.ride.create({
        data: {
          ...rideData,
          paymentMethod: PaymentMethod.card,
          paymentStatus: PaymentStatus.pending,
          amountCents,
          currency,
        },
      });

      try {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: amountCents,
          currency,
          capture_method: 'manual',
          metadata: {
            rideId: ride.id,
          },
        });

        const updatedRide = await this.prisma.ride.update({
          where: { id: ride.id },
          data: {
            stripePaymentIntentId: paymentIntent.id,
          },
        });

        this.logger.log(`Created card ride ${ride.id} with PaymentIntent ${paymentIntent.id}`);
        return {
          ...updatedRide,
          clientSecret: paymentIntent.client_secret,
        };
      } catch (error) {
        await this.prisma.ride.update({
          where: { id: ride.id },
          data: { paymentStatus: PaymentStatus.failed },
        });
        this.logger.error(`Failed to create PaymentIntent for ride ${ride.id}`, error);
        throw new BadRequestException('Failed to create payment intent');
      }
    }

    throw new BadRequestException('Invalid payment method');
  }

  async capturePaymentOnRideComplete(rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException(`Ride ${rideId} not found`);
    }

    if (ride.paymentMethod === PaymentMethod.cash) {
      const updatedRide = await this.prisma.ride.update({
        where: { id: rideId },
        data: {
          status: 'completed',
          paymentStatus: PaymentStatus.cash,
        },
      });
      this.logger.log(`Completed cash ride ${rideId}`);
      return updatedRide;
    }

    if (ride.paymentMethod === PaymentMethod.card) {
      if (!ride.stripePaymentIntentId) {
        throw new BadRequestException(`No PaymentIntent found for ride ${rideId}`);
      }

      try {
        await this.stripe.paymentIntents.capture(ride.stripePaymentIntentId);
        
        const updatedRide = await this.prisma.ride.update({
          where: { id: rideId },
          data: {
            status: 'completed',
            paymentStatus: PaymentStatus.captured,
          },
        });
        this.logger.log(`Captured payment for ride ${rideId}`);
        return updatedRide;
      } catch (error) {
        this.logger.error(`Failed to capture payment for ride ${rideId}`, error);
        await this.prisma.ride.update({
          where: { id: rideId },
          data: { paymentStatus: PaymentStatus.failed },
        });
        throw new BadRequestException('Failed to capture payment');
      }
    }

    throw new BadRequestException('Invalid payment method');
  }

  async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const rideId = paymentIntent.metadata?.rideId;
    if (!rideId) {
      this.logger.warn(`PaymentIntent ${paymentIntent.id} has no rideId in metadata`);
      return;
    }

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { paymentStatus: PaymentStatus.captured },
    });
    this.logger.log(`Payment succeeded for ride ${rideId}`);
  }

  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const rideId = paymentIntent.metadata?.rideId;
    if (!rideId) {
      this.logger.warn(`PaymentIntent ${paymentIntent.id} has no rideId in metadata`);
      return;
    }

    await this.prisma.ride.update({
      where: { id: rideId },
      data: { paymentStatus: PaymentStatus.failed },
    });
    this.logger.log(`Payment failed for ride ${rideId}`);
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
