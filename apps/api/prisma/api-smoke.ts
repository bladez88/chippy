import 'dotenv/config'
import assert from 'node:assert/strict'
import { DateTime } from 'luxon'
import request from 'supertest'
import { app } from '../src/app.js'
import { prisma } from '../src/database/prisma.js'

const smokePassengerId = 'smoke-passenger'
const smokeDriverId = 'smoke-driver'
const smokePassengerTripId = 'smoke-passenger-trip'
const smokeDriverTripId = 'smoke-driver-trip'

async function cleanupRideSmoke() {
  await prisma.carpool.deleteMany({ where: { driverTripId: smokeDriverTripId } })
  await prisma.rideRequest.deleteMany({ where: { OR: [{ driverTripId: smokeDriverTripId }, { passengerTripId: smokePassengerTripId }] } })
  await prisma.trip.deleteMany({ where: { id: { in: [smokePassengerTripId, smokeDriverTripId] } } })
  await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: smokePassengerId }, { addresseeId: smokePassengerId }, { requesterId: smokeDriverId }, { addresseeId: smokeDriverId }] } })
  await prisma.user.deleteMany({ where: { id: { in: [smokePassengerId, smokeDriverId] } } })
}

async function main() {
  const health = await request(app).get('/api/health')
  assert.deepEqual(health.body, { status: 'ok', store: 'prisma' })

  const login = await request(app).post('/api/auth/dev-login').send({ userId: 'user-jimmy' })
  assert.equal(login.status, 200)
  const cookie = login.headers['set-cookie']?.[0]
  assert.ok(cookie)

  const day = DateTime.now().setZone('America/Vancouver').plus({ days: 1 }).toISODate()!
  const calendar = await request(app).get(`/api/calendar?start=${day}&end=${day}&timezone=America%2FVancouver`).set('Cookie', cookie)
  assert.equal(calendar.status, 200)
  assert.ok(calendar.body.events.some((event: { sourceId: string }) => event.sourceId === 'trip-jimmy'))
  assert.ok(calendar.body.events.some((event: { kind: string }) => event.kind === 'POTENTIAL_MATCH'))

  let createdTripId: string | undefined
  try {
    const created = await request(app).post('/api/trips').set('Cookie', cookie).send({
      origin: { label: 'Smoke origin', address: 'Burnaby, BC', latitude: 49.24, longitude: -122.98 },
      destination: { label: 'Smoke destination', address: 'Vancouver, BC', latitude: 49.26, longitude: -123.1 },
      departureAt: DateTime.now().plus({ days: 2 }).toUTC().toISO(),
      timezone: 'America/Vancouver', transportationMode: 'WALKING', carpoolStatus: 'NONE',
    })
    assert.equal(created.status, 201)
    createdTripId = created.body.trips[0]?.id
    assert.ok(createdTripId)
    assert.equal(await prisma.trip.count({ where: { id: createdTripId } }), 1)
    assert.equal((await request(app).delete(`/api/trips/${createdTripId}`).set('Cookie', cookie)).status, 204)
    assert.equal(await prisma.trip.count({ where: { id: createdTripId } }), 0)
    createdTripId = undefined
  } finally {
    if (createdTripId) await prisma.trip.deleteMany({ where: { id: createdTripId } })
  }

  await cleanupRideSmoke()
  try {
    await prisma.user.createMany({ data: [
      { id: smokePassengerId, email: 'smoke-passenger@chippy.local', name: 'Smoke Passenger', timezone: 'America/Vancouver' },
      { id: smokeDriverId, email: 'smoke-driver@chippy.local', name: 'Smoke Driver', timezone: 'America/Vancouver' },
    ] })
    await prisma.friendship.create({ data: { requesterId: smokePassengerId, addresseeId: smokeDriverId, status: 'ACCEPTED' } })
    const departure = DateTime.now().setZone('America/Vancouver').plus({ days: 3 }).startOf('day')
    await prisma.trip.createMany({ data: [
      { id: smokePassengerTripId, userId: smokePassengerId, originLabel: 'Passenger area', originAddress: 'Burnaby, BC', originLat: 49.2488, originLng: -122.9805, destinationLabel: 'SFU', destinationAddress: '8888 University Dr', destinationLat: 49.2781, destinationLng: -122.9199, departureAt: departure.set({ hour: 8, minute: 30 }).toUTC().toJSDate(), timezone: 'America/Vancouver', transportationMode: 'TRANSIT', carpoolStatus: 'LOOKING_FOR_RIDE' },
      { id: smokeDriverTripId, userId: smokeDriverId, originLabel: 'Driver area', originAddress: 'Burnaby, BC', originLat: 49.2512, originLng: -122.975, destinationLabel: 'SFU', destinationAddress: '8888 University Dr', destinationLat: 49.2781, destinationLng: -122.9199, departureAt: departure.set({ hour: 8, minute: 20 }).toUTC().toJSDate(), timezone: 'America/Vancouver', transportationMode: 'DRIVING', carpoolStatus: 'OFFERING_RIDE', availableSeats: 2 },
    ] })
    await prisma.$executeRaw`UPDATE "Trip" SET "originGeog" = ST_SetSRID(ST_MakePoint("originLng", "originLat"), 4326)::geography, "destinationGeog" = ST_SetSRID(ST_MakePoint("destinationLng", "destinationLat"), 4326)::geography WHERE id IN (${smokePassengerTripId}, ${smokeDriverTripId})`
    const passengerLogin = await request(app).post('/api/auth/dev-login').send({ userId: smokePassengerId })
    const rideRequest = await request(app).post('/api/ride-requests').set('Cookie', passengerLogin.headers['set-cookie']?.[0]).send({ driverTripId: smokeDriverTripId, passengerTripId: smokePassengerTripId, fuelContributionAmount: 2 })
    assert.equal(rideRequest.status, 201)
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: smokeDriverId })
    const accepted = await request(app).patch(`/api/ride-requests/${rideRequest.body.request.id}/accept`).set('Cookie', driverLogin.headers['set-cookie']?.[0])
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.request.status, 'ACCEPTED')
    assert.equal(await prisma.carpool.count({ where: { driverTripId: smokeDriverTripId, participants: { some: { tripId: smokePassengerTripId, role: 'PASSENGER' } } } }), 1)
  } finally {
    await cleanupRideSmoke()
  }

  console.log(JSON.stringify({ store: health.body.store, authenticatedUser: login.body.user.email, calendarEvents: calendar.body.events.length, matchFound: true, persistentCreateDelete: true, transactionalRideAcceptance: true }))
}

main().finally(() => prisma.$disconnect())
