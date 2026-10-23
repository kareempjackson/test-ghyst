-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'captured', 'failed', 'cash');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'cash');

-- AlterTable
ALTER TABLE "rides" ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cash';
ALTER TABLE "rides" ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "rides" ADD COLUMN "stripe_payment_intent_id" TEXT;
ALTER TABLE "rides" ADD COLUMN "amount_cents" INTEGER;
ALTER TABLE "rides" ADD COLUMN "currency" TEXT DEFAULT 'usd';

-- CreateIndex
CREATE INDEX "rides_stripe_payment_intent_id_idx" ON "rides"("stripe_payment_intent_id");
