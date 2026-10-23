import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RideStatus, UserRole } from '@prisma/client';

describe('RidesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let rider: any;
  let driver: any;
  let driverProfile: any;
  let completedRide: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    prisma = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    // Clean up in correct order
    await prisma.ride.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.user.deleteMany();

    // Create test rider
    rider = await prisma.user.create({
      data: {
        email: 'rider@test.com',
        firstName: 'Test',
        lastName: 'Rider',
        role: UserRole.RIDER,
      },
    });

    // Create test driver with profile
    driver = await prisma.user.create({
      data: {
        email: 'driver@test.com',
        firstName: 'Test',
        lastName: 'Driver',
        role: UserRole.DRIVER,
      },
    });

    driverProfile = await prisma.driverProfile.create({
      data: {
        userId: driver.id,
        licenseNumber: 'DL123456',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2022,
        vehiclePlate: 'ABC-1234',
        vehicleColor: 'Silver',
        isAvailable: true,
        averageRating: null,
        totalRatings: 0,
        totalRides: 0,
      },
    });

    // Create a completed ride
    completedRide = await prisma.ride.create({
      data: {
        riderId: rider.id,
        driverId: driver.id,
        status: RideStatus.COMPLETED,
        pickupLat: 18.4655,
        pickupLng: -66.1057,
        pickupAddress: '123 Main St, San Juan',
        dropoffLat: 18.4505,
        dropoffLng: -66.0614,
        dropoffAddress: '456 Ocean Ave, San Juan',
        estimatedFare: 25.0,
        actualFare: 27.5,
        completedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.ride.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /rides/:id/rate', () => {
    it('should successfully rate a completed ride', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 5, comment: 'Great ride!' })
        .expect(200);

      expect(response.body.rating).toBe(5);
      expect(response.body.ratingComment).toBe('Great ride!');
      expect(response.body.driver.averageRating).toBe(5);
    });

    it('should rate without comment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 4 })
        .expect(200);

      expect(response.body.rating).toBe(4);
      expect(response.body.ratingComment).toBeNull();
    });

    it('should reject rating from non-rider', async () => {
      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', driver.id)
        .set('x-user-role', 'DRIVER')
        .send({ rating: 5 })
        .expect(403);
    });

    it('should reject duplicate rating', async () => {
      // First rating
      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 5 })
        .expect(200);

      // Second rating attempt
      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 4 })
        .expect(400);
    });

    it('should reject invalid rating value', async () => {
      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 6 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 0 })
        .expect(400);
    });

    it('should reject rating for non-completed ride', async () => {
      const inProgressRide = await prisma.ride.create({
        data: {
          riderId: rider.id,
          driverId: driver.id,
          status: RideStatus.IN_PROGRESS,
          pickupLat: 18.4655,
          pickupLng: -66.1057,
          pickupAddress: '123 Main St',
          dropoffLat: 18.4505,
          dropoffLng: -66.0614,
          dropoffAddress: '456 Ocean Ave',
        },
      });

      await request(app.getHttpServer())
        .post(`/rides/${inProgressRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 5 })
        .expect(400);
    });

    it('should block driver after 10+ rides with average below 3.5', async () => {
      // Update driver to have 9 rides with average of 3.0
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          totalRides: 9,
          totalRatings: 9,
          averageRating: 3.0,
        },
      });

      // Rate with 3 (new average will be (3.0*9 + 3)/10 = 3.0)
      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 3 })
        .expect(200);

      // Check driver is blocked
      const updatedProfile = await prisma.driverProfile.findUnique({
        where: { id: driverProfile.id },
      });

      expect(updatedProfile?.isBlocked).toBe(true);
      expect(updatedProfile?.totalRides).toBe(10);
    });

    it('should not block driver with good rating after 10+ rides', async () => {
      // Update driver to have 9 rides with average of 4.5
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          totalRides: 9,
          totalRatings: 9,
          averageRating: 4.5,
        },
      });

      // Rate with 5 (new average will be (4.5*9 + 5)/10 = 4.55)
      await request(app.getHttpServer())
        .post(`/rides/${completedRide.id}/rate`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .send({ rating: 5 })
        .expect(200);

      // Check driver is not blocked
      const updatedProfile = await prisma.driverProfile.findUnique({
        where: { id: driverProfile.id },
      });

      expect(updatedProfile?.isBlocked).toBe(false);
      expect(updatedProfile?.totalRides).toBe(10);
    });
  });

  describe('GET /rides/:id', () => {
    it('should return ride with driver rating info', async () => {
      // First rate the ride
      await prisma.ride.update({
        where: { id: completedRide.id },
        data: { rating: 5, ratingComment: 'Excellent!', ratedAt: new Date() },
      });

      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: { averageRating: 4.8, totalRatings: 10 },
      });

      const response = await request(app.getHttpServer())
        .get(`/rides/${completedRide.id}`)
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .expect(200);

      expect(response.body.rating).toBe(5);
      expect(response.body.driver.averageRating).toBe(4.8);
    });

    it('should return 404 for non-existent ride', async () => {
      await request(app.getHttpServer())
        .get('/rides/00000000-0000-0000-0000-000000000000')
        .set('x-user-id', rider.id)
        .set('x-user-role', 'RIDER')
        .expect(404);
    });
  });
});
