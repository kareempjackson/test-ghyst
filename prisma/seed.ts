import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Kingston zones with slugs
const zones = [
  { name: 'Downtown Kingston', slug: 'downtown-kingston' },
  { name: 'New Kingston', slug: 'new-kingston' },
  { name: 'Half Way Tree', slug: 'half-way-tree' },
  { name: 'Liguanea', slug: 'liguanea' },
  { name: 'Constant Spring', slug: 'constant-spring' },
  { name: 'Papine', slug: 'papine' },
  { name: 'Cross Roads', slug: 'cross-roads' },
  { name: 'Portmore', slug: 'portmore' },
  { name: 'Norman Manley Airport', slug: 'airport' },
  { name: 'Mona', slug: 'mona' },
];

// Pricing matrix in USD cents (JMD converted at ~155 JMD = 1 USD)
// Base fare ~500 JMD = 323 cents, distance adds 100-300 JMD per km
const pricingMatrix: Record<string, Record<string, number>> = {
  'downtown-kingston': {
    'downtown-kingston': 350,
    'new-kingston': 550,
    'half-way-tree': 600,
    'liguanea': 700,
    'constant-spring': 800,
    'papine': 900,
    'cross-roads': 500,
    'portmore': 1200,
    'airport': 2500,
    'mona': 850,
  },
  'new-kingston': {
    'downtown-kingston': 550,
    'new-kingston': 350,
    'half-way-tree': 400,
    'liguanea': 500,
    'constant-spring': 550,
    'papine': 750,
    'cross-roads': 400,
    'portmore': 1400,
    'airport': 2200,
    'mona': 650,
  },
  'half-way-tree': {
    'downtown-kingston': 600,
    'new-kingston': 400,
    'half-way-tree': 350,
    'liguanea': 450,
    'constant-spring': 500,
    'papine': 700,
    'cross-roads': 350,
    'portmore': 1500,
    'airport': 2400,
    'mona': 600,
  },
  'liguanea': {
    'downtown-kingston': 700,
    'new-kingston': 500,
    'half-way-tree': 450,
    'liguanea': 350,
    'constant-spring': 400,
    'papine': 500,
    'cross-roads': 450,
    'portmore': 1600,
    'airport': 2600,
    'mona': 400,
  },
  'constant-spring': {
    'downtown-kingston': 800,
    'new-kingston': 550,
    'half-way-tree': 500,
    'liguanea': 400,
    'constant-spring': 350,
    'papine': 600,
    'cross-roads': 500,
    'portmore': 1700,
    'airport': 2800,
    'mona': 500,
  },
  'papine': {
    'downtown-kingston': 900,
    'new-kingston': 750,
    'half-way-tree': 700,
    'liguanea': 500,
    'constant-spring': 600,
    'papine': 350,
    'cross-roads': 650,
    'portmore': 1800,
    'airport': 2900,
    'mona': 400,
  },
  'cross-roads': {
    'downtown-kingston': 500,
    'new-kingston': 400,
    'half-way-tree': 350,
    'liguanea': 450,
    'constant-spring': 500,
    'papine': 650,
    'cross-roads': 350,
    'portmore': 1400,
    'airport': 2300,
    'mona': 550,
  },
  'portmore': {
    'downtown-kingston': 1200,
    'new-kingston': 1400,
    'half-way-tree': 1500,
    'liguanea': 1600,
    'constant-spring': 1700,
    'papine': 1800,
    'cross-roads': 1400,
    'portmore': 400,
    'airport': 3200,
    'mona': 1700,
  },
  'airport': {
    'downtown-kingston': 2500,
    'new-kingston': 2200,
    'half-way-tree': 2400,
    'liguanea': 2600,
    'constant-spring': 2800,
    'papine': 2900,
    'cross-roads': 2300,
    'portmore': 3200,
    'airport': 400,
    'mona': 2700,
  },
  'mona': {
    'downtown-kingston': 850,
    'new-kingston': 650,
    'half-way-tree': 600,
    'liguanea': 400,
    'constant-spring': 500,
    'papine': 400,
    'cross-roads': 550,
    'portmore': 1700,
    'airport': 2700,
    'mona': 350,
  },
};

async function main() {
  console.log('Seeding zones...');

  // Upsert zones
  const createdZones: Record<string, string> = {};
  for (const zone of zones) {
    const created = await prisma.zone.upsert({
      where: { slug: zone.slug },
      update: { name: zone.name },
      create: zone,
    });
    createdZones[zone.slug] = created.id;
    console.log(`  Created zone: ${zone.name}`);
  }

  console.log('Seeding pricing matrix...');

  // Create pricing entries
  for (const [fromSlug, destinations] of Object.entries(pricingMatrix)) {
    for (const [toSlug, fareCents] of Object.entries(destinations)) {
      const fromZoneId = createdZones[fromSlug];
      const toZoneId = createdZones[toSlug];

      if (!fromZoneId || !toZoneId) {
        console.warn(`  Skipping ${fromSlug} -> ${toSlug}: zone not found`);
        continue;
      }

      await prisma.pricing.upsert({
        where: {
          fromZoneId_toZoneId: { fromZoneId, toZoneId },
        },
        update: { fareCents },
        create: {
          fromZoneId,
          toZoneId,
          fareCents,
          currency: 'USD',
        },
      });
    }
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
