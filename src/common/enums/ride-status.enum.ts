export enum RideStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const RIDE_STATUS_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  [RideStatus.REQUESTED]: [RideStatus.ACCEPTED, RideStatus.CANCELLED],
  [RideStatus.ACCEPTED]: [RideStatus.DRIVER_ARRIVED, RideStatus.CANCELLED],
  [RideStatus.DRIVER_ARRIVED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
  [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
  [RideStatus.COMPLETED]: [],
  [RideStatus.CANCELLED]: [],
};

export const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.ACCEPTED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS,
];
