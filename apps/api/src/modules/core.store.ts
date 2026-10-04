import type { CalendarEvent, CarpoolStatus, CreateTripInput, FriendDto, Location, NotificationDto, RideRequestDto, TransportationMode, TripDto, UserDto } from '@chippy/shared'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

type InternalTrip = TripDto
type Friendship = { id: string; requesterId: string; addresseeId: string; status: 'PENDING' | 'ACCEPTED' | 'BLOCKED' }
type InternalRequest = Omit<RideRequestDto, 'friend'>
type InternalNotification = NotificationDto & { userId: string }

const place = (label: string, address: string, latitude: number, longitude: number): Location => ({ label, address, latitude, longitude })
const now = DateTime.now().setZone('America/Vancouver')
const at = (days: number, hour: number, minute: number) => now.plus({ days }).startOf('day').set({ hour, minute }).toUTC().toISO()!

export class CoreStore {
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

  private trip(id: string, userId: string, origin: Location, destination: Location, departureAt: string, transportationMode: TransportationMode, carpoolStatus: CarpoolStatus, availableSeats?: number): TripDto {
    return { id, userId, scheduleId: null, origin, destination, departureAt, timezone: 'America/Vancouver', transportationMode, carpoolStatus, availableSeats, estimatedArrivalAt: null }
  }

  user(id: string) { return this.users.find((user) => user.id === id) }
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
  calendar(userId: string, start: string, end: string): CalendarEvent[] {
    const from = DateTime.fromISO(start).startOf('day').toMillis(); const to = DateTime.fromISO(end).endOf('day').toMillis()
    const own = this.trips.filter((trip) => trip.userId === userId && within(trip.departureAt, from, to)).map((trip) => this.event(trip, trip.carpoolStatus === 'MATCHED' ? 'CONFIRMED_CARPOOL' : 'OWN_TRIP'))
    const matches = this.trips.filter((trip) => trip.userId === userId && within(trip.departureAt, from, to)).flatMap((trip) => this.matches(userId, trip.id).map(({ driver, passenger, detourMinutes, distanceMeters }) => {
      const friendTrip = driver.userId === userId ? passenger : driver
      return { ...this.event(friendTrip, 'POTENTIAL_MATCH'), id: `match-${trip.id}-${friendTrip.id}`, sourceId: `${driver.id}:${passenger.id}`, title: `${this.user(friendTrip.userId)?.name} → ${friendTrip.destination.label}`, subtitle: `Potential carpool · ${detourMinutes} min detour`, friend: this.user(friendTrip.userId), detourMinutes, distanceMeters, color: '#f28b5b' } satisfies CalendarEvent
    }))
    return [...own, ...matches].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }
  private event(trip: InternalTrip, kind: CalendarEvent['kind']): CalendarEvent {
    return { id: `${kind}-${trip.id}`, sourceId: trip.id, kind, title: `${trip.origin.label} → ${trip.destination.label}`, subtitle: `${labelMode(trip.transportationMode)}${trip.carpoolStatus === 'OFFERING_RIDE' ? ' · Offering a ride' : trip.carpoolStatus === 'LOOKING_FOR_RIDE' ? ' · Looking for a ride' : ''}`, startsAt: trip.departureAt, endsAt: trip.estimatedArrivalAt, transportationMode: trip.transportationMode, carpoolStatus: trip.carpoolStatus, color: kind === 'CONFIRMED_CARPOOL' ? '#167c63' : '#5c69d8' }
  }
  matches(userId: string, tripId: string) {
    const trip = this.trips.find((item) => item.id === tripId && item.userId === userId)
    if (!trip) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const accepted = new Set(this.friends(userId).filter((friend) => friend.status === 'ACCEPTED').map((friend) => friend.id))
    return this.trips.filter((candidate) => accepted.has(candidate.userId)).flatMap((candidate) => {
      const driver = trip.carpoolStatus === 'OFFERING_RIDE' ? trip : candidate
      const passenger = trip.carpoolStatus === 'LOOKING_FOR_RIDE' ? trip : candidate
      if (driver.carpoolStatus !== 'OFFERING_RIDE' || driver.transportationMode !== 'DRIVING' || passenger.carpoolStatus !== 'LOOKING_FOR_RIDE') return []
      const timeDifference = Math.abs(DateTime.fromISO(driver.departureAt).diff(DateTime.fromISO(passenger.departureAt), 'minutes').minutes)
      const distanceMeters = haversine(driver.destination, passenger.destination)
      const detourMinutes = Math.max(2, Math.round(haversine(driver.origin, passenger.origin) / 650))
      return timeDifference <= 30 && distanceMeters <= 2000 && detourMinutes <= 10 ? [{ driver, passenger, distanceMeters: Math.round(distanceMeters), detourMinutes }] : []
    })
  }
  createRideRequest(userId: string, driverTripId: string, passengerTripId: string, fuelContributionAmount: number | null) {
    const passenger = this.trips.find((trip) => trip.id === passengerTripId)
    if (!passenger || passenger.userId !== userId) throw new DomainError('FORBIDDEN', 'You can only request a ride for your trip', 403)
    const eligible = this.matches(userId, passengerTripId).some((match) => match.driver.id === driverTripId)
    if (!eligible) throw new DomainError('STALE_MATCH', 'This trip is no longer an eligible match', 409)
    if (this.requests.some((request) => request.driverTripId === driverTripId && request.passengerTripId === passengerTripId && request.status === 'PENDING')) throw new DomainError('DUPLICATE_REQUEST', 'A request is already pending', 409)
    const driver = this.trips.find((trip) => trip.id === driverTripId)!
    const request: InternalRequest = { id: randomUUID(), driverTripId, passengerTripId, requestedByUserId: userId, requestType: 'RIDE_REQUEST', status: 'PENDING', fuelContributionAmount, createdAt: new Date().toISOString() }
    this.requests.push(request); passenger.carpoolStatus = 'REQUEST_PENDING'
    this.notify(driver.userId, 'RIDE_REQUEST', 'New ride request', `${this.user(userId)?.name} would like to ride with you.`, request.id)
    return this.requestDto(request, driver.userId)
  }
  rideRequests(userId: string): RideRequestDto[] {
    return this.requests.flatMap((request) => {
      const driver = this.trips.find((trip) => trip.id === request.driverTripId)!
      const passenger = this.trips.find((trip) => trip.id === request.passengerTripId)!
      if (driver.userId !== userId && passenger.userId !== userId) return []
      return [this.requestDto(request, driver.userId === userId ? passenger.userId : driver.userId)]
    })
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
}

const within = (iso: string, from: number, to: number) => { const value = DateTime.fromISO(iso).toMillis(); return value >= from && value <= to }
const labelMode = (mode: TransportationMode) => ({ DRIVING: 'Driving', TRANSIT: 'Transit', WALKING: 'Walking', CYCLING: 'Cycling' })[mode]
const haversine = (a: Location, b: Location) => { const rad = (v: number) => v * Math.PI / 180; const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude); const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLng/2)**2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h)) }
export class DomainError extends Error { constructor(public code: string, message: string, public status: number) { super(message) } }
export const store = new CoreStore()
