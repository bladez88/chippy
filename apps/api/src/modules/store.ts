import type {
  CalendarEvent,
  CreateTripInput,
  FriendDto,
  Location,
  NotificationDto,
  RideRequestDto,
  TransportationMode,
  TripDto,
  TripRoutePlan,
  UpdateTripInput,
  UserDto,
  EmailPasswordRegistrationInput,
} from '@chippy/shared'

export type MaybePromise<T> = T | Promise<T>

export type MatchResult = {
  driver: TripDto
  passenger: TripDto
  distanceMeters: number
  detourMinutes: number
  pickupAt: string
  carpoolArrivalAt: string
  originalArrivalAt: string
  arrivalDifferenceMinutes: number
}

export type RoutePlan = {
  driverTrip: TripDto
  passengers: TripDto[]
  stops: Location[]
  carpoolId: string | null
}

export type CarpoolSummary = {
  id: string
  driverTripId: string
  participantTripIds: string[]
  detourMinutes: number
}

export type MapFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: string
    properties: Record<string, unknown>
    geometry: { type: 'LineString'; coordinates: [number, number][] }
  }>
}

export interface ChippyStore {
  user(id: string): MaybePromise<UserDto | undefined>
  credentialByEmail(email: string): MaybePromise<{ user: UserDto; passwordHash: string | null } | undefined>
  createPasswordUser(input: Omit<EmailPasswordRegistrationInput, 'password'> & { passwordHash: string }): MaybePromise<UserDto>
  findOrCreateGoogleUser(profile: { email: string; name: string; avatarUrl: string | null }): MaybePromise<UserDto>
  listTrips(userId: string): MaybePromise<TripDto[]>
  createTrips(userId: string, input: CreateTripInput): MaybePromise<TripDto[]>
  updateTrip(userId: string, tripId: string, input: UpdateTripInput): MaybePromise<TripDto>
  deleteTrip(userId: string, tripId: string): MaybePromise<void>
  friends(userId: string): MaybePromise<FriendDto[]>
  requestFriend(userId: string, email: string): MaybePromise<void>
  updateFriend(userId: string, id: string, status: 'ACCEPTED' | 'BLOCKED'): MaybePromise<void>
  removeFriend(userId: string, id: string): MaybePromise<void>
  calendar(userId: string, start: string, end: string, timezone?: string, friendIds?: string[]): Promise<CalendarEvent[]>
  matches(userId: string, tripId: string): Promise<MatchResult[]>
  createRideRequest(userId: string, driverTripId: string, passengerTripId: string, fuelContributionAmount: number | null): Promise<RideRequestDto>
  rideRequests(userId: string): Promise<RideRequestDto[]>
  decideRequest(userId: string, id: string, decision: 'ACCEPTED' | 'DECLINED' | 'CANCELLED'): MaybePromise<RideRequestDto>
  listCarpools(userId: string): MaybePromise<CarpoolSummary[]>
  cancelCarpool(userId: string, carpoolId: string): MaybePromise<void>
  removePassenger(userId: string, carpoolId: string, passengerTripId: string): MaybePromise<void>
  leaveCarpool(userId: string, carpoolId: string): MaybePromise<void>
  listNotifications(userId: string): MaybePromise<NotificationDto[]>
  readNotification(userId: string, id: string): MaybePromise<void>
  tripRoutePlan(userId: string, tripId: string): Promise<TripRoutePlan>
  map(userId: string, routing: { getRoute(stops: Location[], mode: TransportationMode): Promise<{ distanceMeters: number; durationSeconds: number; geometry: [number, number][] }> }): Promise<MapFeatureCollection>
}
