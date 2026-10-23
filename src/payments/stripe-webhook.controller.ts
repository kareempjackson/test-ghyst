import { Controller, Post, Req, Headers, HttpCode, HttpStatus, BadRequestException, Logger, RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import Stripe from 'stripe';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available');
    }

    let event: Stripe.Event;
    try {
      event = this.paymentsService.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.paymentsService.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.paymentsService.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
