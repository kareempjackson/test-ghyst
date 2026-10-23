import { Prisma } from '@prisma/client';

// Re-export Prisma enums for easy access
export { UserRole, VerificationStatus, RideStatus, PaymentMethod } from '@prisma/client';

// User with driver profile included
export type UserWithDriverProfile = Prisma.UserGetPayload<{
  include: { driverProfile: true };
}>;

// Ride with all relations
export type RideWithRelations = Prisma.RideGetPayload<{
  include: {
    rider: true;
    driver: true;
    pickupZone: true;
    dropoffZone: true;
  };
}>;

// Zone with pricing relations
export type ZoneWithPricing = Prisma.ZoneGetPayload<{
  include: {
    pricingFrom: true;
    pricingTo: true;
  };
}>;

// Driver profile documents structure
export interface DriverDocuments {
  licensePhoto?: string;
  vehicleRegistration?: string;
  insurance?: string;
  profilePhoto?: string;
  [key: string]: string | undefined;
}
