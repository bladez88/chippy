import type {
  CalendarEvent,
  CarpoolStatus,
  CreateTripInput,
  FriendDto,
  Location,
  NotificationDto,
  RideRequestDto,
  TransportationMode,
  TripDto,
  TripRoutePlan,
  UserDto,
  EmailPasswordRegistrationInput,
} from '@chippy/shared'
import { Prisma, PrismaClient } from '@prisma/client'
import { DateTime } from 'luxon'
import type { RoutingService } from '../integrations/routing/routing-service.js'
import { routingService } from '../integrations/routing/index.js'
import { DomainError } from './core.store.js'
import type { CarpoolSummary, ChippyStore, MapFeatureCollection, MatchResult, RoutePlan } from './store.js'

type Db = PrismaClient | Prisma.TransactionClient
type DbTrip = Prisma.TripGetPayload<Record<string, never>>
type DbUser = Prisma.UserGetPayload<Record<string, never>>

const userDto = (user: DbUser): UserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  timezone: user.timezone,
})

const location = (prefix: 'origin' | 'destination', trip: DbTrip): Location => ({
  label: trip[`${prefix}Label`],
  address: trip[`${prefix}Address`],
  latitude: trip[`${prefix}Lat`],
  longitude: trip[`${prefix}Lng`],
})

const tripDto = (trip: DbTrip): TripDto => ({
  id: trip.id,
  userId: trip.userId,
  scheduleId: trip.scheduleId,
  origin: location('origin', trip),
  destination: location('destination', trip),
  departureAt: trip.departureAt.toISOString(),
  timezone: trip.timezone,
  transportationMode: trip.transportationMode,
  carpoolStatus: trip.carpoolStatus,
  ...(trip.availableSeats === null ? {} : { availableSeats: trip.availableSeats }),
  estimatedArrivalAt: trip.estimatedArrivalAt?.toISOString() ?? null,
})

const tripData = (userId: string, input: CreateTripInput, departureAt: Date, scheduleId: string | null) => ({
  userId,
  scheduleId,
  originLabel: input.origin.label,
  originAddress: input.origin.address,
  originLat: input.origin.latitude,
  originLng: input.origin.longitude,
  destinationLabel: input.destination.label,
  destinationAddress: input.destination.address,
  destinationLat: input.destination.latitude,
  destinationLng: input.destination.longitude,
  departureAt,
  timezone: input.timezone,
  transportationMode: input.transportationMode,
  carpoolStatus: input.carpoolStatus,
  availableSeats: input.availableSeats,
})

async function setTripGeographies(db: Db, tripId: string) {
  await db.$executeRaw`
    UPDATE "Trip"
    SET "originGeog" = ST_SetSRID(ST_MakePoint("originLng", "originLat"), 4326)::geography,
        "destinationGeog" = ST_SetSRID(ST_MakePoint("destinationLng", "destinationLat"), 4326)::geography
    WHERE id = ${tripId}
  `
}

async function setScheduleGeographies(db: Db, scheduleId: string) {
  await db.$executeRaw`
    UPDATE "Schedule"
    SET "originGeog" = ST_SetSRID(ST_MakePoint("originLng", "originLat"), 4326)::geography,
        "destinationGeog" = ST_SetSRID(ST_MakePoint("destinationLng", "destinationLat"), 4326)::geography
    WHERE id = ${scheduleId}
  `
}

export class PrismaStore implements ChippyStore {
  constructor(private prisma: PrismaClient, private routing: RoutingService = routingService) {}

  async user(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    return user ? userDto(user) : undefined
  }

  async credentialByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    return user ? { user: userDto(user), passwordHash: user.passwordHash } : undefined
  }

  async createPasswordUser(input: Omit<EmailPasswordRegistrationInput, 'password'> & { passwordHash: string }) {
    try {
      return userDto(await this.prisma.user.create({ data: { email: input.email, name: input.name, passwordHash: input.passwordHash, timezone: 'America/Vancouver' } }))
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new DomainError('EMAIL_IN_USE', 'An account already exists for that email', 409)
      throw error
    }
  }

  async findOrCreateGoogleUser(profile: { email: string; name: string; avatarUrl: string | null }) {
    const email = profile.email.toLowerCase()
    return userDto(await this.prisma.user.upsert({
      where: { email },
      update: { name: profile.name, avatarUrl: profile.avatarUrl },
      create: { ...profile, email, timezone: 'America/Vancouver' },
    }))
  }

  async listTrips(userId: string) {
    return (await this.prisma.trip.findMany({ where: { userId }, orderBy: { departureAt: 'asc' } })).map(tripDto)
  }

  async createTrips(userId: string, input: CreateTripInput) {
    const dates = recurrenceDates(input)
    return this.prisma.$transaction(async (tx) => {
      let scheduleId: string | null = null
      if (input.recurrence) {
        const sourceTime = DateTime.fromISO(input.departureAt, { setZone: true }).setZone(input.timezone)
        const schedule = await tx.schedule.create({ data: {
          userId,
          originLabel: input.origin.label,
          originAddress: input.origin.address,
          originLat: input.origin.latitude,
          originLng: input.origin.longitude,
          destinationLabel: input.destination.label,
          destinationAddress: input.destination.address,
          destinationLat: input.destination.latitude,
          destinationLng: input.destination.longitude,
          departureTime: sourceTime.toFormat('HH:mm'),
          timezone: input.timezone,
          startDate: new Date(`${input.recurrence.startDate}T00:00:00.000Z`),
          endDate: new Date(`${input.recurrence.endDate}T00:00:00.000Z`),
          daysOfWeek: input.recurrence.daysOfWeek,
          transportationMode: input.transportationMode,
          carpoolStatus: input.carpoolStatus,
          availableSeats: input.availableSeats,
        } })
        scheduleId = schedule.id
        await setScheduleGeographies(tx, schedule.id)
      }
      const created: TripDto[] = []
      for (const departureAt of dates) {
        const trip = await tx.trip.create({ data: tripData(userId, input, departureAt, scheduleId) })
        await setTripGeographies(tx, trip.id)
        created.push(tripDto(trip))
      }
      return created
    })
  }

  async friends(userId: string): Promise<FriendDto[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: { requester: true, addressee: true },
      orderBy: { createdAt: 'asc' },
    })
    return friendships.map((friendship) => ({
      ...userDto(friendship.requesterId === userId ? friendship.addressee : friendship.requester),
      friendshipId: friendship.id,
      status: friendship.status,
      direction: friendship.addresseeId === userId ? 'INCOMING' : 'OUTGOING',
    }))
  }

  async requestFriend(userId: string, email: string) {
    const other = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!other || other.id === userId) throw new DomainError('FRIEND_NOT_FOUND', 'No eligible Chippy user has that email', 404)
    const existing = await this.prisma.friendship.findFirst({ where: { OR: [
      { requesterId: userId, addresseeId: other.id },
      { requesterId: other.id, addresseeId: userId },
    ] } })
    if (existing) throw new DomainError('FRIEND_EXISTS', 'A friendship or request already exists', 409)
    await this.prisma.friendship.create({ data: { requesterId: userId, addresseeId: other.id } })
  }

  async updateFriend(userId: string, id: string, status: 'ACCEPTED' | 'BLOCKED') {
    const result = await this.prisma.friendship.updateMany({ where: { id, addresseeId: userId }, data: { status } })
    if (!result.count) throw new DomainError('NOT_FOUND', 'Friend request not found', 404)
  }

  async removeFriend(userId: string, id: string) {
    const result = await this.prisma.friendship.deleteMany({ where: { id, OR: [{ requesterId: userId }, { addresseeId: userId }] } })
    if (!result.count) throw new DomainError('NOT_FOUND', 'Friendship not found', 404)
  }

  async calendar(userId: string, start: string, end: string, timezone = 'America/Vancouver'): Promise<CalendarEvent[]> {
    const from = DateTime.fromISO(start, { zone: timezone }).startOf('day').toUTC().toJSDate()
    const to = DateTime.fromISO(end, { zone: timezone }).endOf('day').toUTC().toJSDate()
    const ownTrips = (await this.prisma.trip.findMany({ where: { userId, departureAt: { gte: from, lte: to } }, orderBy: { departureAt: 'asc' } })).map(tripDto)
    const own = await Promise.all(ownTrips.map(async (trip) => {
      const plan = await this.routePlan(trip)
      const route = await this.routing.getRoute(plan.stops, plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode)
      const [pendingRideRequestCount, passengerCount] = await Promise.all([
        this.prisma.rideRequest.count({ where: { driverTripId: trip.id, status: 'PENDING' } }),
        plan.carpoolId ? this.prisma.carpoolParticipant.count({ where: { carpoolId: plan.carpoolId, role: 'PASSENGER' } }) : 0,
      ])
      return this.event(trip, trip.carpoolStatus === 'MATCHED' ? 'CONFIRMED_CARPOOL' : 'OWN_TRIP', Math.max(1, Math.round(route.durationSeconds / 60)), passengerCount, pendingRideRequestCount)
    }))
    const matchGroups = await Promise.all(ownTrips.map(async (trip) => trip.carpoolStatus !== 'LOOKING_FOR_RIDE' ? [] : (await this.matches(userId, trip.id)).map((match) => {
      const friendTrip = match.driver.userId === userId ? match.passenger : match.driver
      return { ...this.event(friendTrip, 'POTENTIAL_MATCH'), id: `match-${trip.id}-${friendTrip.id}`, sourceId: `${match.driver.id}:${match.passenger.id}`, title: `${match.friend.name} → ${friendTrip.destination.label}`, subtitle: `Potential carpool · ${match.detourMinutes} min detour`, friend: match.friend, detourMinutes: match.detourMinutes, distanceMeters: match.distanceMeters, originalArrivalAt: match.originalArrivalAt, carpoolArrivalAt: match.carpoolArrivalAt, pickupAt: match.pickupAt, color: '#f28b5b' } satisfies CalendarEvent
    })))
    return [...own, ...matchGroups.flat()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }

  async matches(userId: string, tripId: string, allowPendingPassenger = false): Promise<Array<MatchResult & { friend: UserDto }>> {
    const dbTrip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } })
    if (!dbTrip) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const trip = tripDto(dbTrip)
    const accepted = await this.prisma.friendship.findMany({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } })
    const friendIds = accepted.map((item) => item.requesterId === userId ? item.addresseeId : item.requesterId)
    if (!friendIds.length) return []
    const localDay = DateTime.fromISO(trip.departureAt).setZone(trip.timezone)
    const dayStart = localDay.startOf('day').toUTC().toJSDate()
    const dayEnd = localDay.endOf('day').toUTC().toJSDate()
    const passengerSeeking = trip.carpoolStatus === 'LOOKING_FOR_RIDE' || (allowPendingPassenger && trip.carpoolStatus === 'REQUEST_PENDING')
    const candidates = await this.prisma.trip.findMany({ where: {
      userId: { in: friendIds },
      departureAt: { gte: dayStart, lte: dayEnd },
      ...(trip.carpoolStatus === 'OFFERING_RIDE'
        ? { carpoolStatus: 'LOOKING_FOR_RIDE' as const }
        : { carpoolStatus: allowPendingPassenger ? { in: ['OFFERING_RIDE', 'MATCHED'] as CarpoolStatus[] } : 'OFFERING_RIDE' as const, transportationMode: 'DRIVING' as const }),
    } })
    const staged: Array<{ driver: TripDto; passenger: TripDto; distanceMeters: number }> = []
    for (const candidateRow of candidates) {
      const candidate = tripDto(candidateRow)
      const driver = trip.carpoolStatus === 'OFFERING_RIDE' ? trip : candidate
      const passenger = passengerSeeking ? trip : candidate
      const driverEligible = driver.carpoolStatus === 'OFFERING_RIDE' || (allowPendingPassenger && driver.carpoolStatus === 'MATCHED')
      const passengerEligible = passenger.carpoolStatus === 'LOOKING_FOR_RIDE' || (allowPendingPassenger && passenger.carpoolStatus === 'REQUEST_PENDING')
      if (!driverEligible || driver.transportationMode !== 'DRIVING' || !passengerEligible) continue
      const minutes = Math.abs(DateTime.fromISO(driver.departureAt).diff(DateTime.fromISO(passenger.departureAt), 'minutes').minutes)
      if (minutes > 30) continue
      const rows = await this.prisma.$queryRaw<Array<{ distance: number | null }>>`
        SELECT ST_Distance(a."destinationGeog", b."destinationGeog") AS distance
        FROM "Trip" a, "Trip" b
        WHERE a.id = ${driver.id} AND b.id = ${passenger.id}
      `
      const distanceMeters = rows[0]?.distance ?? haversine(driver.destination, passenger.destination)
      if (distanceMeters <= 2_000) staged.push({ driver, passenger, distanceMeters: Math.round(distanceMeters) })
    }
    const routed = await Promise.all(staged.map(async ({ driver, passenger, distanceMeters }) => {
      const [normal, carpool, passengerRoute, friend] = await Promise.all([
        this.routing.getRoute([driver.origin, driver.destination], 'DRIVING'),
        this.routing.getRoute([driver.origin, passenger.origin, driver.destination], 'DRIVING'),
        this.routing.getRoute([passenger.origin, passenger.destination], passenger.transportationMode),
        this.user(driver.userId === userId ? passenger.userId : driver.userId),
      ])
      const detourMinutes = Math.max(0, Math.round((carpool.durationSeconds - normal.durationSeconds) / 60))
      const driverDeparture = DateTime.fromISO(driver.departureAt)
      return { driver, passenger, friend: friend!, distanceMeters, detourMinutes, pickupAt: driverDeparture.plus({ seconds: carpool.legs[0]?.durationSeconds ?? 0 }).toUTC().toISO()!, carpoolArrivalAt: driverDeparture.plus({ seconds: carpool.durationSeconds }).toUTC().toISO()!, originalArrivalAt: DateTime.fromISO(passenger.departureAt).plus({ seconds: passengerRoute.durationSeconds }).toUTC().toISO()! }
    }))
    return routed.filter((match) => match.detourMinutes <= 10)
  }

  async createRideRequest(userId: string, driverTripId: string, passengerTripId: string, fuelContributionAmount: number | null) {
    const passenger = await this.prisma.trip.findUnique({ where: { id: passengerTripId } })
    if (!passenger || passenger.userId !== userId) throw new DomainError('FORBIDDEN', 'You can only request a ride for your trip', 403)
    const eligible = (await this.matches(userId, passengerTripId)).some((match) => match.driver.id === driverTripId)
    if (!eligible) throw new DomainError('STALE_MATCH', 'This trip is no longer an eligible match', 409)
    const duplicate = await this.prisma.rideRequest.findFirst({ where: { driverTripId, passengerTripId, status: 'PENDING' } })
    if (duplicate) throw new DomainError('DUPLICATE_REQUEST', 'A request is already pending', 409)
    const created = await this.prisma.$transaction(async (tx) => {
      const driver = await tx.trip.findUniqueOrThrow({ where: { id: driverTripId } })
      const request = await tx.rideRequest.create({ data: { driverTripId, passengerTripId, requestedByUserId: userId, requestType: 'RIDE_REQUEST', fuelContributionAmount } })
      await tx.trip.update({ where: { id: passengerTripId }, data: { carpoolStatus: 'REQUEST_PENDING' } })
      const requester = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      await tx.notification.create({ data: { userId: driver.userId, type: 'RIDE_REQUEST', title: 'New ride request', body: `${requester.name} would like to ride with you.`, referenceId: request.id } })
      return { request, friendId: driver.userId }
    })
    return this.requestDto(created.request, created.friendId)
  }

  async rideRequests(userId: string): Promise<RideRequestDto[]> {
    const requests = await this.prisma.rideRequest.findMany({
      where: { OR: [{ driverTrip: { userId } }, { passengerTrip: { userId } }] },
      include: { driverTrip: true, passengerTrip: true },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(requests.map(async (request) => {
      const driver = tripDto(request.driverTrip)
      const passenger = tripDto(request.passengerTrip)
      const dto = await this.requestDto(request, driver.userId === userId ? passenger.userId : driver.userId)
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

  async decideRequest(userId: string, id: string, decision: 'ACCEPTED' | 'DECLINED' | 'CANCELLED') {
    const current = await this.prisma.rideRequest.findUnique({ where: { id }, include: { driverTrip: true, passengerTrip: true } })
    if (!current || current.status !== 'PENDING') throw new DomainError('NOT_FOUND', 'Pending request not found', 404)
    if (decision === 'CANCELLED' ? current.passengerTrip.userId !== userId : current.driverTrip.userId !== userId) throw new DomainError('FORBIDDEN', 'You cannot update this request', 403)
    if (decision === 'ACCEPTED') {
      const stillEligible = (await this.matches(current.passengerTrip.userId, current.passengerTripId, true)).some((match) => match.driver.id === current.driverTripId)
      if (!stillEligible) throw new DomainError('STALE_MATCH', 'This trip is no longer an eligible match', 409)
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.rideRequest.findUniqueOrThrow({ where: { id }, include: { driverTrip: true, passengerTrip: true } })
      if (request.status !== 'PENDING') throw new DomainError('NOT_FOUND', 'Pending request not found', 404)
      if (decision === 'ACCEPTED') {
        let carpool = await tx.carpool.findUnique({ where: { driverTripId: request.driverTripId } })
        const used = carpool ? await tx.carpoolParticipant.count({ where: { carpoolId: carpool.id, role: 'PASSENGER' } }) : 0
        if (used >= (request.driverTrip.availableSeats ?? 1)) throw new DomainError('NO_SEATS', 'This ride is full', 409)
        carpool ??= await tx.carpool.create({ data: { driverTripId: request.driverTripId, estimatedDriverDetourMinutes: 5 } })
        await tx.carpoolParticipant.createMany({ data: [
          { carpoolId: carpool.id, tripId: request.driverTripId, userId: request.driverTrip.userId, role: 'DRIVER' },
          { carpoolId: carpool.id, tripId: request.passengerTripId, userId: request.passengerTrip.userId, role: 'PASSENGER' },
        ], skipDuplicates: true })
        await tx.trip.updateMany({ where: { id: { in: [request.driverTripId, request.passengerTripId] } }, data: { carpoolStatus: 'MATCHED' } })
        await tx.rideRequest.update({ where: { id }, data: { status: decision } })
        const driver = await tx.user.findUniqueOrThrow({ where: { id: request.driverTrip.userId } })
        await tx.notification.create({ data: { userId: request.passengerTrip.userId, type: 'RIDE_ACCEPTED', title: 'Ride confirmed', body: `${driver.name} accepted your ride request.`, referenceId: carpool.id } })
      } else {
        await tx.rideRequest.update({ where: { id }, data: { status: decision } })
        await tx.trip.update({ where: { id: request.passengerTripId }, data: { carpoolStatus: 'LOOKING_FOR_RIDE' } })
        await tx.notification.create({ data: { userId: request.passengerTrip.userId, type: decision === 'DECLINED' ? 'RIDE_DECLINED' : 'CARPOOL_CANCELLED', title: decision === 'DECLINED' ? 'Ride request declined' : 'Ride request cancelled', body: 'Your ride request was updated.', referenceId: request.id } })
      }
      return tx.rideRequest.findUniqueOrThrow({ where: { id } })
    })
    return this.requestDto(updated, current.driverTrip.userId === userId ? current.passengerTrip.userId : current.driverTrip.userId)
  }

  async listCarpools(userId: string): Promise<CarpoolSummary[]> {
    const carpools = await this.prisma.carpool.findMany({ where: { OR: [{ driverTrip: { userId } }, { participants: { some: { userId } } }] }, include: { participants: true } })
    return carpools.map((carpool) => ({ id: carpool.id, driverTripId: carpool.driverTripId, participantTripIds: carpool.participants.filter((item) => item.role === 'PASSENGER').map((item) => item.tripId), detourMinutes: carpool.estimatedDriverDetourMinutes ?? 0 }))
  }

  async cancelCarpool(userId: string, carpoolId: string) {
    await this.prisma.$transaction(async (tx) => {
      const carpool = await tx.carpool.findUnique({ where: { id: carpoolId }, include: { driverTrip: true, participants: { include: { trip: true } } } })
      if (!carpool) throw new DomainError('NOT_FOUND', 'Carpool not found', 404)
      if (carpool.driverTrip.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the driver can cancel this carpool', 403)
      const driver = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      for (const participant of carpool.participants.filter((item) => item.role === 'PASSENGER')) {
        await tx.trip.update({ where: { id: participant.tripId }, data: { carpoolStatus: 'LOOKING_FOR_RIDE' } })
        await tx.notification.create({ data: { userId: participant.userId, type: 'CARPOOL_CANCELLED', title: 'Drive cancelled', body: `${driver.name} cancelled the drive. Your original trip is available again.`, referenceId: carpool.id } })
      }
      await tx.rideRequest.updateMany({ where: { driverTripId: carpool.driverTripId, status: 'ACCEPTED' }, data: { status: 'CANCELLED' } })
      await tx.trip.update({ where: { id: carpool.driverTripId }, data: { carpoolStatus: 'OFFERING_RIDE' } })
      await tx.carpool.delete({ where: { id: carpool.id } })
    })
  }

  async removePassenger(userId: string, carpoolId: string, passengerTripId: string) {
    const carpool = await this.prisma.carpool.findUnique({ where: { id: carpoolId }, include: { driverTrip: true } })
    if (!carpool) throw new DomainError('NOT_FOUND', 'Carpool not found', 404)
    if (carpool.driverTrip.userId !== userId) throw new DomainError('FORBIDDEN', 'Only the driver can remove a passenger', 403)
    await this.removePassengerFromCarpool(carpoolId, passengerTripId, userId)
  }

  async leaveCarpool(userId: string, carpoolId: string) {
    const participant = await this.prisma.carpoolParticipant.findFirst({ where: { carpoolId, userId, role: 'PASSENGER' } })
    if (!participant) throw new DomainError('NOT_FOUND', 'Your confirmed ride was not found', 404)
    await this.removePassengerFromCarpool(carpoolId, participant.tripId, userId)
  }

  async deleteTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } })
    if (!trip) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const carpool = await this.prisma.carpool.findFirst({ where: { OR: [{ driverTripId: tripId }, { participants: { some: { tripId } } }] }, include: { driverTrip: true } })
    if (carpool) {
      if (carpool.driverTripId === tripId) await this.cancelCarpool(userId, carpool.id)
      else await this.removePassengerFromCarpool(carpool.id, tripId, userId)
    }
    await this.prisma.$transaction([
      this.prisma.rideRequest.deleteMany({ where: { OR: [{ driverTripId: tripId }, { passengerTripId: tripId }] } }),
      this.prisma.carpoolParticipant.deleteMany({ where: { tripId } }),
      this.prisma.trip.delete({ where: { id: tripId } }),
    ])
  }

  async listNotifications(userId: string): Promise<NotificationDto[]> {
    return (await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })).map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, referenceId: item.referenceId, readAt: item.readAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() }))
  }

  async readNotification(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } })
    if (!result.count) throw new DomainError('NOT_FOUND', 'Notification not found', 404)
  }

  async tripRoutePlan(userId: string, tripId: string): Promise<TripRoutePlan> {
    const row = await this.prisma.trip.findFirst({ where: { id: tripId, userId } })
    if (!row) throw new DomainError('NOT_FOUND', 'Trip not found', 404)
    const trip = tripDto(row)
    const plan = await this.routePlan(trip)
    const mode = plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode
    const [route, originalRoute, driver, passengerUsers] = await Promise.all([
      this.routing.getRoute(plan.stops, mode),
      this.routing.getRoute([trip.origin, trip.destination], trip.transportationMode),
      this.user(plan.driverTrip.userId),
      Promise.all(plan.passengers.map((item) => this.user(item.userId))),
    ])
    const departure = DateTime.fromISO(plan.driverTrip.departureAt)
    let elapsedSeconds = 0
    const stopTimes = plan.stops.map((_stop, index) => { if (index > 0) elapsedSeconds += route.legs[index - 1]?.durationSeconds ?? 0; return departure.plus({ seconds: elapsedSeconds }).toUTC().toISO()! })
    const passengerIndex = plan.passengers.findIndex((item) => item.id === trip.id)
    const role = plan.carpoolId ? (plan.driverTrip.id === trip.id ? 'DRIVER' : 'PASSENGER') : trip.carpoolStatus === 'OFFERING_RIDE' ? 'DRIVER' : 'SOLO'
    return { tripId: trip.id, carpoolId: plan.carpoolId, role, driver: driver!, departureAt: plan.driverTrip.departureAt, pickupAt: passengerIndex >= 0 ? stopTimes[passengerIndex + 1]! : null, originalArrivalAt: DateTime.fromISO(trip.departureAt).plus({ seconds: originalRoute.durationSeconds }).toUTC().toISO()!, carpoolArrivalAt: departure.plus({ seconds: route.durationSeconds }).toUTC().toISO()!, distanceMeters: Math.round(route.distanceMeters), durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)), stops: plan.stops.map((stop, index) => ({ tripId: index > 0 && index <= plan.passengers.length ? plan.passengers[index - 1]!.id : null, kind: index === 0 ? 'ORIGIN' : index === plan.stops.length - 1 ? 'DESTINATION' : 'PICKUP', label: index > 0 && index <= plan.passengers.length ? `${passengerUsers[index - 1]?.name}'s pickup` : stop.label, address: stop.address, estimatedAt: stopTimes[index]!, friend: index > 0 && index <= plan.passengers.length ? passengerUsers[index - 1]! : index === 0 ? driver! : null })) }
  }

  async map(userId: string, routing: RoutingService): Promise<MapFeatureCollection> {
    const trips = (await this.prisma.trip.findMany({ where: { userId, departureAt: { gte: new Date() } }, orderBy: { departureAt: 'asc' } })).map(tripDto)
    const features = await Promise.all(trips.map(async (trip) => {
      const plan = await this.routePlan(trip)
      const routeMode = plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode
      const route = await routing.getRoute(plan.stops, routeMode)
      const [driver, passengers] = await Promise.all([this.user(plan.driverTrip.userId), Promise.all(plan.passengers.map((item) => this.user(item.userId)))])
      const stops = [{ kind: 'ORIGIN', ...plan.driverTrip.origin, friendName: driver?.name }, ...plan.passengers.map((passenger, index) => ({ kind: 'PICKUP', ...passenger.origin, label: `${passengers[index]?.name}'s pickup`, friendName: passengers[index]?.name })), { kind: 'DESTINATION', ...plan.driverTrip.destination, friendName: null }]
      return { type: 'Feature' as const, id: trip.id, properties: { title: `${plan.driverTrip.origin.label} → ${plan.driverTrip.destination.label}`, originLabel: plan.driverTrip.origin.label, destinationLabel: plan.driverTrip.destination.label, status: trip.carpoolStatus, departureAt: trip.departureAt, transportationMode: routeMode, passengerCount: plan.passengers.length, distanceMeters: Math.round(route.distanceMeters), durationSeconds: Math.round(route.durationSeconds), stops }, geometry: { type: 'LineString' as const, coordinates: route.geometry } }
    }))
    return { type: 'FeatureCollection', features }
  }

  private event(trip: TripDto, kind: CalendarEvent['kind'], estimatedDurationMinutes?: number, passengerCount = 0, pendingRideRequestCount = 0): CalendarEvent {
    return { id: `${kind}-${trip.id}`, sourceId: trip.id, kind, title: `${trip.origin.label} → ${trip.destination.label}`, subtitle: `${labelMode(trip.transportationMode)}${trip.carpoolStatus === 'OFFERING_RIDE' ? ' · Offering a ride' : trip.carpoolStatus === 'LOOKING_FOR_RIDE' ? ' · Looking for a ride' : ''}`, startsAt: trip.departureAt, endsAt: trip.estimatedArrivalAt, transportationMode: trip.transportationMode, carpoolStatus: trip.carpoolStatus, originLabel: trip.origin.label, destinationLabel: trip.destination.label, passengerCount, pendingRideRequestCount, estimatedDurationMinutes, color: kind === 'CONFIRMED_CARPOOL' ? '#167c63' : '#5c69d8' }
  }

  private async requestDto(request: { id: string; driverTripId: string; passengerTripId: string; requestedByUserId: string; requestType: 'RIDE_REQUEST' | 'RIDE_OFFER'; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'; fuelContributionAmount: Prisma.Decimal | number | null; createdAt: Date }, friendId: string): Promise<RideRequestDto> {
    return { id: request.id, driverTripId: request.driverTripId, passengerTripId: request.passengerTripId, requestedByUserId: request.requestedByUserId, requestType: request.requestType, status: request.status, fuelContributionAmount: request.fuelContributionAmount === null ? null : Number(request.fuelContributionAmount), createdAt: request.createdAt.toISOString(), friend: (await this.user(friendId))! }
  }

  private async routePlan(trip: TripDto): Promise<RoutePlan> {
    const carpool = await this.prisma.carpool.findFirst({ where: { OR: [{ driverTripId: trip.id }, { participants: { some: { tripId: trip.id } } }] } })
    if (!carpool) return { driverTrip: trip, passengers: [], stops: [trip.origin, trip.destination], carpoolId: null }
    const [driverRow, passengerRows] = await Promise.all([
      this.prisma.trip.findUniqueOrThrow({ where: { id: carpool.driverTripId } }),
      this.prisma.carpoolParticipant.findMany({ where: { carpoolId: carpool.id, role: 'PASSENGER' }, include: { trip: true }, orderBy: { trip: { departureAt: 'asc' } } }),
    ])
    const driverTrip = tripDto(driverRow)
    const passengers = passengerRows.map((item) => tripDto(item.trip))
    return { driverTrip, passengers, stops: [driverTrip.origin, ...passengers.map((item) => item.origin), driverTrip.destination], carpoolId: carpool.id }
  }

  private async removePassengerFromCarpool(carpoolId: string, passengerTripId: string, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      const carpool = await tx.carpool.findUnique({ where: { id: carpoolId }, include: { driverTrip: true } })
      const participant = await tx.carpoolParticipant.findUnique({ where: { carpoolId_tripId: { carpoolId, tripId: passengerTripId } }, include: { trip: true } })
      if (!carpool || !participant || participant.role !== 'PASSENGER') throw new DomainError('NOT_FOUND', 'Passenger was not found in this carpool', 404)
      await tx.carpoolParticipant.delete({ where: { carpoolId_tripId: { carpoolId, tripId: passengerTripId } } })
      await tx.trip.update({ where: { id: passengerTripId }, data: { carpoolStatus: 'LOOKING_FOR_RIDE' } })
      await tx.rideRequest.updateMany({ where: { driverTripId: carpool.driverTripId, passengerTripId, status: 'ACCEPTED' }, data: { status: 'CANCELLED' } })
      const remaining = await tx.carpoolParticipant.count({ where: { carpoolId, role: 'PASSENGER' } })
      await tx.trip.update({ where: { id: carpool.driverTripId }, data: { carpoolStatus: remaining ? 'MATCHED' : 'OFFERING_RIDE' } })
      const passengerUser = await tx.user.findUniqueOrThrow({ where: { id: participant.userId } })
      const otherUserId = actorUserId === carpool.driverTrip.userId ? participant.userId : carpool.driverTrip.userId
      await tx.notification.create({ data: { userId: otherUserId, type: 'CARPOOL_CANCELLED', title: actorUserId === carpool.driverTrip.userId ? 'Passenger removed' : 'Passenger left', body: actorUserId === carpool.driverTrip.userId ? 'Your original trip is available again.' : `${passengerUser.name} left the carpool.`, referenceId: carpool.id } })
      if (!remaining) await tx.carpool.delete({ where: { id: carpool.id } })
    })
  }
}

const recurrenceDates = (input: CreateTripInput) => {
  const sourceTime = DateTime.fromISO(input.departureAt, { setZone: true }).setZone(input.timezone)
  if (!input.recurrence) return [sourceTime.toUTC().toJSDate()]
  const dates: Date[] = []
  let cursor = DateTime.fromISO(input.recurrence.startDate, { zone: input.timezone }).startOf('day')
  const end = DateTime.fromISO(input.recurrence.endDate, { zone: input.timezone }).endOf('day')
  while (cursor <= end) {
    if (input.recurrence.daysOfWeek.includes(cursor.weekday % 7)) dates.push(cursor.set({ hour: sourceTime.hour, minute: sourceTime.minute }).toUTC().toJSDate())
    cursor = cursor.plus({ days: 1 })
  }
  return dates
}

const labelMode = (mode: TransportationMode) => ({ DRIVING: 'Driving', TRANSIT: 'Transit', WALKING: 'Walking', CYCLING: 'Cycling' })[mode]
const haversine = (a: Location, b: Location) => { const rad = (v: number) => v * Math.PI / 180; const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2; return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) }
const generalArea = (address: string) => { const parts = address.split(',').map((part) => part.trim()).filter(Boolean); const last = parts.at(-1)?.toLowerCase(); const cityIndex = last === 'canada' || last === 'ca' ? parts.length - 3 : parts.length > 2 ? parts.length - 2 : 0; return `${parts[Math.max(0, cityIndex)] ?? 'Pickup'} area` }
