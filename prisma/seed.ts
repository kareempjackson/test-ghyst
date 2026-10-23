import { PrismaClient, UserRole, VerificationStatus, RideStatus, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Caribbean zones
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { name: 'Kingston Downtown' },
      update: {},
      create: { name: 'Kingston Downtown' },
    }),
    prisma.zone.upsert({
      where: { name: 'New Kingston' },
      update: {},
      create: { name: 'New Kingston' },
    }),
    prisma.zone.upsert({
      where: { name: 'Half Way Tree' },
      update: {},
      create: { name: 'Half Way Tree' },
    }),
    prisma.zone.upsert({
      where: { name: 'Montego Bay' },
      update: {},
      create: { name: 'Montego Bay' },
    }),
    prisma.zone.upsert({
      where: { name: 'Ocho Rios' },
      update: {},
      create: { name: 'Ocho Rios' },
    }),
    prisma.zone.upsert({
      where: { name: 'Portmore' },
      update: {},
      create: { name: 'Portmore' },
    }),
  ]);

  console.log(`✅ Created ${zones.length} zones`);

  // Create zone pricing (sample pricing matrix)
  const pricingData: { from: string; to: string; price: number }[] = [
    { from: 'Kingston Downtown', to: 'New Kingston', price: 50000 },
    { from: 'Kingston Downtown', to: 'Half Way Tree', price: 60000 },
    { from: 'Kingston Downtown', to: 'Portmore', price: 80000 },
    { from: 'New Kingston', to: 'Kingston Downtown', price: 50000 },
    { from: 'New Kingston', to: 'Half Way Tree', price: 35000 },
    { from: 'New Kingston', to: 'Portmore', price: 90000 },
    { from: 'Half Way Tree', to: 'Kingston Downtown', price: 60000 },
    { from: 'Half Way Tree', to: 'New Kingston', price: 35000 },
    { from: 'Half Way Tree', to: 'Portmore', price: 85000 },
    { from: 'Montego Bay', to: 'Ocho Rios', price: 350000 },
    { from: 'Ocho Rios', to: 'Montego Bay', price: 350000 },
  ];

  const zoneMap = new Map(zones.map((z) => [z.name, z.id]));

  for (const pricing of pricingData) {
    const fromZoneId = zoneMap.get(pricing.from)!;
    const toZoneId = zoneMap.get(pricing.to)!;

    await prisma.zonePricing.upsert({
      where: {
        fromZoneId_toZoneId: { fromZoneId, toZoneId },
      },
      update: { priceCents: pricing.price },
      create: {
        fromZoneId,
        toZoneId,
        priceCents: pricing.price,
      },
    });
  }

  console.log(`✅ Created ${pricingData.length} zone pricing entries`);

  // Create sample users
  const rider = await prisma.user.upsert({
    where: { phone: '+1876555001' },
    update: {},
    create: {
      phone: '+1876555001',
      name: 'Marcus Johnson',
      role: UserRole.RIDER,
    },
  });

  const driver = await prisma.user.upsert({
    where: { phone: '+1876555002' },
    update: {},
    create: {
      phone: '+1876555002',
      name: 'Andre Williams',
      role: UserRole.DRIVER,
      driverProfile: {
        create: {
          licenseNumber: 'JM-DL-123456',
          vehiclePlate: 'ABC 1234',
          vehicleModel: 'Toyota Corolla 2020',
          verificationStatus: VerificationStatus.APPROVED,
          documents: {
            licensePhoto: 'uploads/licenses/andre-license.jpg',
            vehicleRegistration: 'uploads/vehicles/andre-registration.pdf',
            insurance: 'uploads/insurance/andre-insurance.pdf',
          },
        },
      },
    },
  });

  console.log('✅ Created sample users');

  // Create a sample completed ride
  const kingstonDowntown = zones.find((z) => z.name === 'Kingston Downtown')!;
  const newKingston = zones.find((z) => z.name === 'New Kingston')!;

  await prisma.ride.create({
    data: {
      riderId: rider.id,
      driverId: driver.id,
      pickupZoneId: kingstonDowntown.id,
      dropoffZoneId: newKingston.id,
      status: RideStatus.COMPLETED,
      fareCents: 50000,
      paymentMethod: PaymentMethod.CASH,
      rating: 5,
      requestedAt: new Date('2024-01-15T10:00:00Z'),
      acceptedAt: new Date('2024-01-15T10:02:00Z'),
      driverArrivedAt: new Date('2024-01-15T10:08:00Z'),
      startedAt: new Date('2024-01-15T10:10:00Z'),
      completedAt: new Date('2024-01-15T10:25:00Z'),
    },
  });

  console.log('✅ Created sample ride');
  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
