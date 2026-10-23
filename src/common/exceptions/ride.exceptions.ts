import { HttpException, HttpStatus } from '@nestjs/common';

export class RideNotFoundException extends HttpException {
  constructor(rideId: string) {
    super(`Ride with ID ${rideId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class InvalidRideStateTransitionException extends HttpException {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Cannot transition from ${currentStatus} to ${targetStatus}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class UnauthorizedRideActionException extends HttpException {
  constructor(action: string) {
    super(
      `You are not authorized to ${action} this ride`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class NoActiveRideException extends HttpException {
  constructor() {
    super('No active ride found', HttpStatus.NOT_FOUND);
  }
}

export class RideAlreadyAcceptedException extends HttpException {
  constructor() {
    super('This ride has already been accepted by another driver', HttpStatus.CONFLICT);
  }
}
