import type { CalendarEvent, CarpoolStatus, CreateTripInput, EmailPasswordRegistrationInput, FriendDto, Location, NotificationDto, RideRequestDto, TransportationMode, TripDto, TripRoutePlan, UpdateTripInput, UserDto } from '@chippy/shared'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import type { RoutingService } from '../integrations/routing/routing-service.js'
import { routingService } from '../integrations/routing/index.js'
import type { ChippyStore, MapFeatureCollection } from './store.js'

type InternalTrip = TripDto
type Friendship = { id: string; requesterId: string; addresseeId: string; status: 'PENDING' | 'ACCEPTED' | 'BLOCKED' }
type InternalRequest = Omit<RideRequestDto, 'friend'>
type InternalNotification = NotificationDto & { userId: string }

const place = (label: string, address: string, latitude: number, longitude: number): Location => ({ label, address, latitude, longitude })
const now = DateTime.now().setZone('America/Vancouver')
const at = (days: number, hour: number, minute: number) => now.plus({ days }).startOf('day').set({ hour, minute }).toUTC().toISO()!

export class CoreStore implements ChippyStore {
  constructor(private routing: RoutingService = routingService) {}
  users: UserDto[] = [
    { id: 'user-jimmy', email: 'jimmy@chippy.local', name: 'Jimmy', avatarUrl: null, timezone: 'America/Vancouver' },
    { id: 'user-daniel', email: 'daniel@chippy.local', name: 'Daniel', avatarUrl: null, timezone: 'America/Vancouver' },
  ]
  friendships: Friendship[] = [{ id: 'friend-demo', requesterId: 'user-jimmy', addresseeId: 'user-daniel', status: 'ACCEPTED' }]
  trips: InternalTrip[] = [
    this.trip('trip-jimmy', 'user-jimmy', place('Home', 'Burnaby, BC', 49.2488, -122.9805), place('SFU', '8888 University Dr', 49.2781, -122.9199), at(1, 8, 30), 'TRANSIT', 'LOOKING_FOR_RIDE'),
    this.trip('trip-daniel', 'user-daniel', place('Daniel’s neighbourhood', 'Burnaby, BC', 49.2512, -122.975), place('SFU', '8888 University Dr', 49.2781, -122.9199), at(1, 8, 20), 'DRIVING', 'OFFERING_RIDE', 3),
  ]
  requests: InternalRequest[] = []
  notifications: InternalNotification[] = []
  carpools: { id: string; driverTripId: string; participantTripIds: string[]; detourMinutes: number }[] = []
  passwordHashes = new Map<string, string>()

  private trip(id: string, userId: string, origin: Location, destination: Location, departureAt: string, transportationMode: TransportationMode, carpoolStatus: CarpoolStatus, availableSeats?: number): TripDto {
    return { id, userId, scheduleId: null, origin, destination, departureAt, timezone: 'America/Vancouver', transportationMode, carpoolStatus, availableSeats, estimatedArrivalAt: null }
  }

  user(id: string) { return this.users.find((user) => user.id === id) }
  credentialByEmail(email: string) {
    const user = this.users.find((item) => item.email === email)
    return user ? { user, passwordHash: this.passwordHashes.get(user.id) ?? null } : undefined
  }
  createPasswordUser(input: Omit<EmailPasswordRegistrationInput, 'password'> & { passwordHash: string }) {
    if (this.users.some((item) => item.email === input.email)) throw new DomainError('EMAIL_IN_USE', 'An account already exists for that email', 409)
    const user = { id: `user-password-${randomUUID()}`, email: input.email, name: input.name, avatarUrl: null, timezone: 'America/Vancouver' }
    this.users.push(user)
    this.passwordHashes.set(user.id, input.passwordHash)
    return user
  }
  findOrCreateGoogleUser(profile: { email: string; name: string; avatarUrl: string | null }) {
    const email = profile.email.toLowerCase()
    let user = this.users.find((item) => item.email === email)
    if (!user) {
      user = { id: randomUUID(), ...profile, email, timezone: 'America/Vancouver' }
      this.users.push(user)
    }
    return user
  }
  listTrips(userId: string) { return this.trips.filter((trip) => trip.userId === userId) }
  createTrips(userId: string, input: CreateTripInput) {
    const dates: string[] = []
    if (input.recurrence) {
      let cursor = DateTime.fromISO(input.recurrence.startDate, { zone: input.timezone }).startOf('day')
      const end = DateTime.fromISO(input.recurrence.endDate, { zone: input.timezone }).endOf('day')
      while (cursor <= end) {
        if (input.recurrence.daysOfWeek.includes(cursor.weekday % 7)) dates.push(cursor.toISODate()!)
        cursor = cursor.plus({ days: 1 })
      }
    } else dates.push(DateTime.fromISO(input.departureAt, { setZone: true }).setZone(input.timezone).toISODate()!)
    const sourceTime = DateTime.fromISO(input.departureAt, { setZone: true }).setZone(input.timezone)
    const scheduleId = input.recurrence ? randomUUID() : null
    const created = dates.map((date) => this.trip(randomUUID(), userId, input.origin, input.destination, DateTime.fromISO(date, { zone: input.timezone }).set({ hour: sourceTime.hour, minute: sourceTime.minute }).toUTC().toISO()!, input.transportationMode, input.carpoolStatus, input.availableSeats))
    created.forEach((trip) => { trip.scheduleId = scheduleId })
    this.trips.push(...created)
    return created
  }
  updateTrip(userId: string, tripId: string, input: UpdateTripInput) {
    const trip = this.trips.find((item) => item.id === tripId && item.userId === userId)
    if (!trip) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const disruptsCoordination = trip.departureAt !== input.departureAt || trip.transportationMode !== input.transportationMode || trip.carpoolStatus !== input.carpoolStatus
    if (disruptsCoordination) {
      const carpool = this.carpools.find((item) => item.driverTripId === tripId || item.participantTripIds.includes(tripId))
      if (carpool) {
        if (carpool.driverTripId === tripId) this.cancelCarpool(userId, carpool.id)
        else this.removePassengerFromCarpool(carpool.id, tripId, userId)
      }
      this.requests.filter((request) => (request.driverTripId === tripId || request.passengerTripId === tripId) && request.status === 'PENDING').forEach((request) => {
        request.status = 'CANCELLED'
        const passenger = this.trips.find((item) => item.id === request.passengerTripId)
        if (passenger && passenger.id !== tripId) passenger.carpoolStatus = 'LOOKING_FOR_RIDE'
      })
    }
    trip.departureAt = input.departureAt
    trip.timezone = input.timezone
    trip.transportationMode = input.transportationMode
    trip.carpoolStatus = input.carpoolStatus
    trip.availableSeats = input.carpoolStatus === 'OFFERING_RIDE' ? input.availableSeats : undefined
    return trip
  }
  friends(userId: string): FriendDto[] {
    return this.friendships.filter((f) => f.requesterId === userId || f.addresseeId === userId).map((f) => {
      const otherId = f.requesterId === userId ? f.addresseeId : f.requesterId
      return { ...this.user(otherId)!, friendshipId: f.id, status: f.status, direction: f.addresseeId === userId ? 'INCOMING' : 'OUTGOING' }
    })
  }
  requestFriend(userId: string, email: string) {
    const other = this.users.find((user) => user.email.toLowerCase() === email.toLowerCase())
    if (!other || other.id === userId) throw new DomainError('FRIEND_NOT_FOUND', 'No eligible Chippy user has that email', 404)
    if (this.friendships.some((f) => [f.requesterId, f.addresseeId].includes(userId) && [f.requesterId, f.addresseeId].includes(other.id))) throw new DomainError('FRIEND_EXISTS', 'A friendship or request already exists', 409)
    this.friendships.push({ id: randomUUID(), requesterId: userId, addresseeId: other.id, status: 'PENDING' })
  }
  updateFriend(userId: string, id: string, status: 'ACCEPTED' | 'BLOCKED') {
    const friend = this.friendships.find((f) => f.id === id && f.addresseeId === userId)
    if (!friend) throw new DomainError('NOT_FOUND', 'Friend request not found', 404)
    friend.status = status
  }
  removeFriend(userId: string, id: string) {
    const index = this.friendships.findIndex((f) => f.id === id && (f.requesterId === userId || f.addresseeId === userId))
    if (index < 0) throw new DomainError('NOT_FOUND', 'Friendship not found', 404)
    this.friendships.splice(index, 1)
  }
  listCarpools(userId: string) {
    return this.carpools.filter((carpool) => {
      const driver = this.trips.find((trip) => trip.id === carpool.driverTripId)
      return driver?.userId === userId || carpool.participantTripIds.some((id) => this.trips.find((trip) => trip.id === id)?.userId === userId)
    })
  }
  async calendar(userId: string, start: string, end: string, _timezone = 'America/Vancouver', friendIds: string[] = []): Promise<CalendarEvent[]> {
    const from = DateTime.fromISO(start).startOf('day').toMillis(); const to = DateTime.fromISO(end).endOf('day').toMillis()
    const ownTrips = this.trips.filter((trip) => trip.userId === userId && within(trip.departureAt, from, to))
    const own = await Promise.all(ownTrips.map(async (trip) => { const plan = this.routePlan(trip); const route = await this.routing.getRoute(plan.stops, plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode); const pendingRideRequestCount = this.requests.filter((request) => request.driverTripId === trip.id && request.status === 'PENDING').length; return this.event(trip, trip.carpoolStatus === 'MATCHED' ? 'CONFIRMED_CARPOOL' : 'OWN_TRIP', Math.max(1, Math.round(route.durationSeconds / 60)), plan.passengers.length, pendingRideRequestCount) }))
    const matchGroups = await Promise.all(ownTrips.map(async (trip) => trip.carpoolStatus !== 'LOOKING_FOR_RIDE' ? [] : (await this.matches(userId, trip.id)).map(({ driver, passenger, detourMinutes, distanceMeters, originalArrivalAt, carpoolArrivalAt, pickupAt }) => {
      const friendTrip = driver.userId === userId ? passenger : driver
      return { ...this.event(friendTrip, 'POTENTIAL_MATCH'), id: `match-${trip.id}-${friendTrip.id}`, sourceId: `${driver.id}:${passenger.id}`, title: `${this.user(friendTrip.userId)?.name} → ${friendTrip.destination.label}`, subtitle: `Potential carpool · ${detourMinutes} min detour`, friend: this.user(friendTrip.userId), detourMinutes, distanceMeters, originalArrivalAt, carpoolArrivalAt, pickupAt, color: '#f28b5b' } satisfies CalendarEvent
    })))
    const matches = matchGroups.flat()
    const acceptedIds = new Set(this.friends(userId).filter((friend) => friend.status === 'ACCEPTED' && friendIds.includes(friend.id)).map((friend) => friend.id))
    const friendEvents = this.trips.filter((trip) => acceptedIds.has(trip.userId) && within(trip.departureAt, from, to)).map((trip) => {
      const friend = this.user(trip.userId)!
      return { ...this.event(trip, 'FRIEND_TRIP'), title: `${friend.name}'s trip`, subtitle: 'Friend schedule · details private', originLabel: 'Private origin', destinationLabel: 'Private destination', friend, color: '#7c6ee6' } satisfies CalendarEvent
    })
    return [...own, ...matches, ...friendEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }
  private event(trip: InternalTrip, kind: CalendarEvent['kind'], estimatedDurationMinutes?: number, passengerCount = 0, pendingRideRequestCount = 0): CalendarEvent {
    return { id: `${kind}-${trip.id}`, sourceId: trip.id, kind, title: `${trip.origin.label} → ${trip.destination.label}`, subtitle: `${labelMode(trip.transportationMode)}${trip.carpoolStatus === 'OFFERING_RIDE' ? ' · Offering a ride' : trip.carpoolStatus === 'LOOKING_FOR_RIDE' ? ' · Looking for a ride' : ''}`, startsAt: trip.departureAt, endsAt: trip.estimatedArrivalAt, transportationMode: trip.transportationMode, carpoolStatus: trip.carpoolStatus, originLabel: trip.origin.label, destinationLabel: trip.destination.label, passengerCount, pendingRideRequestCount, estimatedDurationMinutes, color: kind === 'CONFIRMED_CARPOOL' ? '#167c63' : '#5c69d8' }
  }
  async matches(userId: string, tripId: string) {
    const trip = this.trips.find((item) => item.id === tripId && item.userId === userId)
    if (!trip) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const accepted = new Set(this.friends(userId).filter((friend) => friend.status === 'ACCEPTED').map((friend) => friend.id))
    const candidates = this.trips.filter((candidate) => accepted.has(candidate.userId)).flatMap((candidate) => {
      const driver = trip.carpoolStatus === 'OFFERING_RIDE' ? trip : candidate
      const passenger = trip.carpoolStatus === 'LOOKING_FOR_RIDE' ? trip : candidate
      if (driver.carpoolStatus !== 'OFFERING_RIDE' || driver.transportationMode !== 'DRIVING' || passenger.carpoolStatus !== 'LOOKING_FOR_RIDE') return []
      const timeDifference = Math.abs(DateTime.fromISO(driver.departureAt).diff(DateTime.fromISO(passenger.departureAt), 'minutes').minutes)
      const distanceMeters = haversine(driver.destination, passenger.destination)
      return timeDifference <= 30 && distanceMeters <= 2000 ? [{ driver, passenger, distanceMeters: Math.round(distanceMeters) }] : []
    })
    const routed = await Promise.all(candidates.map(async ({ driver, passenger, distanceMeters }) => {
      const [normal, carpool, passengerRoute] = await Promise.all([this.routing.getRoute([driver.origin, driver.destination], 'DRIVING'), this.routing.getRoute([driver.origin, passenger.origin, driver.destination], 'DRIVING'), this.routing.getRoute([passenger.origin, passenger.destination], passenger.transportationMode)])
      const detourMinutes = Math.max(0, Math.round((carpool.durationSeconds - normal.durationSeconds) / 60))
      const driverDeparture = DateTime.fromISO(driver.departureAt)
      return { driver, passenger, distanceMeters, detourMinutes, pickupAt: driverDeparture.plus({ seconds: carpool.legs[0]?.durationSeconds ?? 0 }).toUTC().toISO()!, carpoolArrivalAt: driverDeparture.plus({ seconds: carpool.durationSeconds }).toUTC().toISO()!, originalArrivalAt: DateTime.fromISO(passenger.departureAt).plus({ seconds: passengerRoute.durationSeconds }).toUTC().toISO()! }
    }))
    return routed.filter((match) => match.detourMinutes <= 10)
  }
  async createRideRequest(userId: string, driverTripId: string, passengerTripId: string, fuelContributionAmount: number | null) {
    const passenger = this.trips.find((trip) => trip.id === passengerTripId)
    if (!passenger || passenger.userId !== userId) throw new DomainError('FORBIDDEN', 'You can only request a ride for your trip', 403)
    const eligible = (await this.matches(userId, passengerTripId)).some((match) => match.driver.id === driverTripId)
    if (!eligible) throw new DomainError('STALE_MATCH', 'This trip is no longer an eligible match', 409)
    if (this.requests.some((request) => request.driverTripId === driverTripId && request.passengerTripId === passengerTripId && request.status === 'PENDING')) throw new DomainError('DUPLICATE_REQUEST', 'A request is already pending', 409)
    const driver = this.trips.find((trip) => trip.id === driverTripId)!
    const request: InternalRequest = { id: randomUUID(), driverTripId, passengerTripId, requestedByUserId: userId, requestType: 'RIDE_REQUEST', status: 'PENDING', fuelContributionAmount, createdAt: new Date().toISOString() }
    this.requests.push(request); passenger.carpoolStatus = 'REQUEST_PENDING'
    this.notify(driver.userId, 'RIDE_REQUEST', 'New ride request', `${this.user(userId)?.name} would like to ride with you.`, request.id)
    return this.requestDto(request, driver.userId)
  }
  async rideRequests(userId: string): Promise<RideRequestDto[]> {
    const visible = this.requests.flatMap((request) => {
      const driver = this.trips.find((trip) => trip.id === request.driverTripId)!
      const passenger = this.trips.find((trip) => trip.id === request.passengerTripId)!
      if (driver.userId !== userId && passenger.userId !== userId) return []
      return [{ request, driver, passenger }]
    })
    return Promise.all(visible.map(async ({ request, driver, passenger }) => {
      const dto = this.requestDto(request, driver.userId === userId ? passenger.userId : driver.userId)
      if (driver.userId !== userId || request.status !== 'PENDING') return dto
      const [original, proposed] = await Promise.all([this.routing.getRoute([driver.origin, driver.destination], 'DRIVING'), this.routing.getRoute([driver.origin, passenger.origin, driver.destination], 'DRIVING')])
      const departure = DateTime.fromISO(driver.departureAt)
      const originalDurationMinutes = Math.max(0, Math.round(original.durationSeconds / 60))
      const proposedDurationMinutes = Math.max(0, Math.round(proposed.durationSeconds / 60))
      return { ...dto, routeImpact: {
        originalArrivalAt: departure.plus({ seconds: original.durationSeconds }).toUTC().toISO()!, proposedArrivalAt: departure.plus({ seconds: proposed.durationSeconds }).toUTC().toISO()!, pickupAt: departure.plus({ seconds: proposed.legs[0]?.durationSeconds ?? 0 }).toUTC().toISO()!,
        originalDistanceMeters: Math.round(original.distanceMeters), proposedDistanceMeters: Math.round(proposed.distanceMeters), addedDistanceMeters: Math.max(0, Math.round(proposed.distanceMeters - original.distanceMeters)),
        originalDurationMinutes, proposedDurationMinutes, addedDurationMinutes: Math.max(0, proposedDurationMinutes - originalDurationMinutes),
        routeStops: { from: driver.origin.label, pickup: generalArea(passenger.origin.address), to: driver.destination.label },
      } }
    }))
  }
  decideRequest(userId: string, id: string, decision: 'ACCEPTED' | 'DECLINED' | 'CANCELLED') {
    const request = this.requests.find((item) => item.id === id)
    if (!request || request.status !== 'PENDING') throw new DomainError('NOT_FOUND', 'Pending request not found', 404)
    const driver = this.trips.find((trip) => trip.id === request.driverTripId)!; const passenger = this.trips.find((trip) => trip.id === request.passengerTripId)!
    if (decision === 'CANCELLED' ? passenger.userId !== userId : driver.userId !== userId) throw new DomainError('FORBIDDEN', 'You cannot update this request', 403)
    request.status = decision
    if (decision === 'ACCEPTED') {
      const used = this.carpools.find((carpool) => carpool.driverTripId === driver.id)?.participantTripIds.length ?? 0
      if (used >= (driver.availableSeats ?? 1)) throw new DomainError('NO_SEATS', 'This ride is full', 409)
      let carpool = this.carpools.find((item) => item.driverTripId === driver.id)
      if (!carpool) { carpool = { id: randomUUID(), driverTripId: driver.id, participantTripIds: [], detourMinutes: 5 }; this.carpools.push(carpool) }
      carpool.participantTripIds.push(passenger.id); driver.carpoolStatus = 'MATCHED'; passenger.carpoolStatus = 'MATCHED'
      this.notify(passenger.userId, 'RIDE_ACCEPTED', 'Ride confirmed', `${this.user(driver.userId)?.name} accepted your ride request.`, carpool.id)
    } else { passenger.carpoolStatus = 'LOOKING_FOR_RIDE'; this.notify(passenger.userId, decision === 'DECLINED' ? 'RIDE_DECLINED' : 'CARPOOL_CANCELLED', decision === 'DECLINED' ? 'Ride request declined' : 'Ride request cancelled', 'Your ride request was updated.', request.id) }
    return this.requestDto(request, driver.userId === userId ? passenger.userId : driver.userId)
  }
  listNotifications(userId: string) { return this.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ userId: _, ...n }) => n) }
  readNotification(userId: string, id: string) { const item = this.notifications.find((n) => n.id === id && n.userId === userId); if (!item) throw new DomainError('NOT_FOUND', 'Notification not found', 404); item.readAt = new Date().toISOString() }
  private notify(userId: string, type: NotificationDto['type'], title: string, body: string, referenceId: string) { this.notifications.push({ id: randomUUID(), userId, type, title, body, referenceId, readAt: null, createdAt: new Date().toISOString() }) }
  private requestDto(request: InternalRequest, friendId: string): RideRequestDto { return { ...request, friend: this.user(friendId)! } }
  deleteTrip(userId: string, tripId: string) {
    const index = this.trips.findIndex((trip) => trip.id === tripId && trip.userId === userId)
    if (index < 0) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const carpool = this.carpools.find((item) => item.driverTripId === tripId || item.participantTripIds.includes(tripId))
    if (carpool) {
      if (carpool.driverTripId === tripId) this.cancelCarpool(userId, carpool.id)
      else this.removePassengerFromCarpool(carpool.id, tripId, userId)
    }
    this.requests.filter((request) => request.driverTripId === tripId || request.passengerTripId === tripId).forEach((request) => { if (request.status === 'PENDING') request.status = 'CANCELLED' })
    const currentIndex = this.trips.findIndex((trip) => trip.id === tripId)
    if (currentIndex >= 0) this.trips.splice(currentIndex, 1)
  }
  cancelCarpool(userId: string, carpoolId: string) {
    const index = this.carpools.findIndex((item) => item.id === carpoolId)
    const carpool = this.carpools[index]
    const driver = carpool && this.trips.find((trip) => trip.id === carpool.driverTripId)
    if (!carpool || !driver) throw new DomainError('NOT_FOUND', 'Carpool not found', 404)
    if (driver.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the driver can cancel this carpool', 403)
    for (const passengerTripId of carpool.participantTripIds) {
      const passenger = this.trips.find((trip) => trip.id === passengerTripId)
      if (!passenger) continue
      passenger.carpoolStatus = 'LOOKING_FOR_RIDE'
      this.notify(passenger.userId, 'CARPOOL_CANCELLED', 'Drive cancelled', `${this.user(driver.userId)?.name} cancelled the drive. Your original trip is available again.`, carpool.id)
    }
    this.requests.filter((request) => request.driverTripId === driver.id && request.status === 'ACCEPTED').forEach((request) => { request.status = 'CANCELLED' })
    driver.carpoolStatus = 'OFFERING_RIDE'
    this.carpools.splice(index, 1)
  }
  removePassenger(userId: string, carpoolId: string, passengerTripId: string) {
    const carpool = this.carpools.find((item) => item.id === carpoolId)
    const driver = carpool && this.trips.find((trip) => trip.id === carpool.driverTripId)
    if (!carpool || !driver) throw new DomainError('NOT_FOUND', 'Carpool not found', 404)
    if (driver.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the driver can remove a passenger', 403)
    this.removePassengerFromCarpool(carpoolId, passengerTripId, userId)
  }
  leaveCarpool(userId: string, carpoolId: string) {
    const carpool = this.carpools.find((item) => item.id === carpoolId)
    const passengerTrip = carpool?.participantTripIds.map((id) => this.trips.find((trip) => trip.id === id)).find((trip) => trip?.userId === userId)
    if (!carpool || !passengerTrip) throw new DomainError('NOT_FOUND', 'Your confirmed ride was not found', 404)
    this.removePassengerFromCarpool(carpoolId, passengerTrip.id, userId)
  }
  private removePassengerFromCarpool(carpoolId: string, passengerTripId: string, actorUserId: string) {
    const carpool = this.carpools.find((item) => item.id === carpoolId)
    const participantIndex = carpool?.participantTripIds.indexOf(passengerTripId) ?? -1
    const passenger = this.trips.find((trip) => trip.id === passengerTripId)
    const driver = carpool && this.trips.find((trip) => trip.id === carpool.driverTripId)
    if (!carpool || participantIndex < 0 || !passenger || !driver) throw new DomainError('NOT_FOUND', 'Passenger was not found in this carpool', 404)
    carpool.participantTripIds.splice(participantIndex, 1)
    passenger.carpoolStatus = 'LOOKING_FOR_RIDE'
    driver.carpoolStatus = carpool.participantTripIds.length ? 'MATCHED' : 'OFFERING_RIDE'
    this.requests.filter((request) => request.driverTripId === driver.id && request.passengerTripId === passenger.id && request.status === 'ACCEPTED').forEach((request) => { request.status = 'CANCELLED' })
    const otherUserId = actorUserId === driver.userId ? passenger.userId : driver.userId
    this.notify(otherUserId, 'CARPOOL_CANCELLED', actorUserId === driver.userId ? 'Passenger removed' : 'Passenger left', actorUserId === driver.userId ? 'Your original trip is available again.' : `${this.user(passenger.userId)?.name} left the carpool.`, carpool.id)
    if (!carpool.participantTripIds.length) this.carpools.splice(this.carpools.indexOf(carpool), 1)
  }
  async tripRoutePlan(userId: string, tripId: string): Promise<TripRoutePlan> {
    const trip = this.trips.find((item) => item.id === tripId && item.userId === userId)
    if (!trip) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const plan = this.routePlan(trip)
    const mode = plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode
    const [route, originalRoute] = await Promise.all([this.routing.getRoute(plan.stops, mode), this.routing.getRoute([trip.origin, trip.destination], trip.transportationMode)])
    const departure = DateTime.fromISO(plan.driverTrip.departureAt)
    let elapsedSeconds = 0
    const stopTimes = plan.stops.map((_stop, index) => { if (index > 0) elapsedSeconds += route.legs[index - 1]?.durationSeconds ?? 0; return departure.plus({ seconds: elapsedSeconds }).toUTC().toISO()! })
    const passengerIndex = plan.passengers.findIndex((item) => item.id === trip.id)
    const role = plan.carpoolId ? (plan.driverTrip.id === trip.id ? 'DRIVER' : 'PASSENGER') : trip.carpoolStatus === 'OFFERING_RIDE' ? 'DRIVER' : 'SOLO'
    return {
      tripId: trip.id, carpoolId: plan.carpoolId, role, driver: this.user(plan.driverTrip.userId)!, departureAt: plan.driverTrip.departureAt,
      pickupAt: passengerIndex >= 0 ? stopTimes[passengerIndex + 1]! : null,
      originalArrivalAt: DateTime.fromISO(trip.departureAt).plus({ seconds: originalRoute.durationSeconds }).toUTC().toISO()!,
      carpoolArrivalAt: departure.plus({ seconds: route.durationSeconds }).toUTC().toISO()!, distanceMeters: Math.round(route.distanceMeters), durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
      stops: plan.stops.map((stop, index) => ({ tripId: index > 0 && index <= plan.passengers.length ? plan.passengers[index - 1]!.id : null, kind: index === 0 ? 'ORIGIN' : index === plan.stops.length - 1 ? 'DESTINATION' : 'PICKUP', label: index > 0 && index <= plan.passengers.length ? `${this.user(plan.passengers[index - 1]!.userId)?.name}'s pickup` : stop.label, address: stop.address, estimatedAt: stopTimes[index]!, friend: index > 0 && index <= plan.passengers.length ? this.user(plan.passengers[index - 1]!.userId)! : index === 0 ? this.user(plan.driverTrip.userId)! : null })),
    }
  }
  routePlan(trip: InternalTrip) {
    const carpool = this.carpools.find((item) => item.driverTripId === trip.id || item.participantTripIds.includes(trip.id))
    if (!carpool) return { driverTrip: trip, passengers: [] as InternalTrip[], stops: [trip.origin, trip.destination], carpoolId: null }
    const driverTrip = this.trips.find((item) => item.id === carpool.driverTripId)!
    const passengers = carpool.participantTripIds.map((id) => this.trips.find((item) => item.id === id)).filter((item): item is InternalTrip => Boolean(item))
    return { driverTrip, passengers, stops: [driverTrip.origin, ...passengers.map((item) => item.origin), driverTrip.destination], carpoolId: carpool.id }
  }
  async map(userId: string, routing: RoutingService): Promise<MapFeatureCollection> {
    const own = this.trips.filter((trip) => trip.userId === userId && new Date(trip.departureAt).getTime() >= Date.now()).sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    const features = await Promise.all(own.map(async (trip) => {
      const plan = this.routePlan(trip)
      const routeMode = plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode
      const route = await routing.getRoute(plan.stops, routeMode)
      const stops = [
        { kind: 'ORIGIN', label: plan.driverTrip.origin.label, address: plan.driverTrip.origin.address, latitude: plan.driverTrip.origin.latitude, longitude: plan.driverTrip.origin.longitude, friendName: this.user(plan.driverTrip.userId)?.name },
        ...plan.passengers.map((passenger) => ({ kind: 'PICKUP', label: `${this.user(passenger.userId)?.name}'s pickup`, address: passenger.origin.address, latitude: passenger.origin.latitude, longitude: passenger.origin.longitude, friendName: this.user(passenger.userId)?.name })),
        { kind: 'DESTINATION', label: plan.driverTrip.destination.label, address: plan.driverTrip.destination.address, latitude: plan.driverTrip.destination.latitude, longitude: plan.driverTrip.destination.longitude, friendName: null },
      ]
      return { type: 'Feature' as const, id: trip.id, properties: { title: `${plan.driverTrip.origin.label} → ${plan.driverTrip.destination.label}`, originLabel: plan.driverTrip.origin.label, destinationLabel: plan.driverTrip.destination.label, status: trip.carpoolStatus, departureAt: trip.departureAt, transportationMode: routeMode, passengerCount: plan.passengers.length, distanceMeters: Math.round(route.distanceMeters), durationSeconds: Math.round(route.durationSeconds), stops }, geometry: { type: 'LineString' as const, coordinates: route.geometry } }
    }))
    return { type: 'FeatureCollection', features }
  }
}

const within = (iso: string, from: number, to: number) => { const value = DateTime.fromISO(iso).toMillis(); return value >= from && value <= to }
const labelMode = (mode: TransportationMode) => ({ DRIVING: 'Driving', TRANSIT: 'Transit', WALKING: 'Walking', CYCLING: 'Cycling' })[mode]
const haversine = (a: Location, b: Location) => { const rad = (v: number) => v * Math.PI / 180; const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude); const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLng/2)**2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h)) }
const generalArea = (address: string) => { const parts = address.split(',').map((part) => part.trim()).filter(Boolean); const last = parts.at(-1)?.toLowerCase(); const cityIndex = last === 'canada' || last === 'ca' ? parts.length - 3 : parts.length > 2 ? parts.length - 2 : 0; return `${parts[Math.max(0, cityIndex)] ?? 'Pickup'} area` }
export class DomainError extends Error { constructor(public code: string, message: string, public status: number) { super(message) } }
export const store = new CoreStore()
