import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from './app.js'
import { store } from './modules/core.store.js'

const seededJimmyDeparture = store.trips.find((trip) => trip.id === 'trip-jimmy')!.departureAt
const seededDanielDeparture = store.trips.find((trip) => trip.id === 'trip-daniel')!.departureAt

describe('Chippy API vertical slice', () => {
  let cookie = ''
  beforeEach(async () => {
    const response = await request(app).post('/api/auth/dev-login').send({ userId: 'user-jimmy' })
    cookie = response.headers['set-cookie']?.[0] ?? ''
    store.users = store.users.filter((user) => !user.id.startsWith('user-password-'))
    store.passwordHashes.clear()
    store.requests.length = 0
    store.carpools.length = 0
    store.notifications.length = 0
    store.trips.find((trip) => trip.id === 'trip-jimmy')!.carpoolStatus = 'LOOKING_FOR_RIDE'
    store.trips.find((trip) => trip.id === 'trip-jimmy')!.transportationMode = 'TRANSIT'
    store.trips.find((trip) => trip.id === 'trip-jimmy')!.departureAt = seededJimmyDeparture
    store.trips.find((trip) => trip.id === 'trip-daniel')!.carpoolStatus = 'OFFERING_RIDE'
    store.trips.find((trip) => trip.id === 'trip-daniel')!.transportationMode = 'DRIVING'
    store.trips.find((trip) => trip.id === 'trip-daniel')!.departureAt = seededDanielDeparture
    store.trips.find((trip) => trip.id === 'trip-daniel')!.availableSeats = 3
  })
  it('rejects unauthenticated calendar reads', async () => expect((await request(app).get('/api/calendar?start=2026-01-01&end=2026-01-31')).status).toBe(401))
  it('returns the authenticated profile', async () => expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).body.user.email).toBe('jimmy@chippy.local'))
  it('registers an email/password account and signs it in', async () => {
    const credentials = { name: 'Alex Chen', email: '  ALEX@example.com ', password: 'correct-horse-battery-staple' }
    const registered = await request(app).post('/api/auth/register').send(credentials)
    expect(registered.status).toBe(201)
    expect(registered.body.user).toMatchObject({ name: 'Alex Chen', email: 'alex@example.com' })
    expect(registered.headers['set-cookie']?.[0]).toContain('chippy_session=')
    const storedHash = store.passwordHashes.get(registered.body.user.id)
    expect(storedHash).toMatch(/^scrypt\$/)
    expect(storedHash).not.toContain(credentials.password)

    const signedIn = await request(app).post('/api/auth/login').send({ email: 'alex@example.com', password: credentials.password })
    expect(signedIn.status).toBe(200)
    expect(signedIn.body.user.id).toBe(registered.body.user.id)
  })
  it('rejects duplicate registration and incorrect passwords without exposing account details', async () => {
    const credentials = { name: 'Alex Chen', email: 'alex@example.com', password: 'correct-horse-battery-staple' }
    await request(app).post('/api/auth/register').send(credentials)
    const duplicate = await request(app).post('/api/auth/register').send(credentials)
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE')
    const rejected = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'definitely-not-the-password' })
    expect(rejected.status).toBe(401)
    expect(rejected.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' })
  })
  it('returns calendar events', async () => { const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000); const response = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`).set('Cookie', cookie); expect(response.status).toBe(200); expect(response.body.events.length).toBeGreaterThan(0) })
  it('recalculates calendar duration for each transportation mode', async () => {
    const trip = store.trips.find((item) => item.id === 'trip-jimmy')!
    trip.carpoolStatus = 'NONE'
    const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000)
    const duration = async (mode: typeof trip.transportationMode) => {
      trip.transportationMode = mode
      const events = await store.calendar('user-jimmy', start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))
      return events.find((event) => event.sourceId === trip.id)!.estimatedDurationMinutes!
    }
    const driving = await duration('DRIVING')
    const transit = await duration('TRANSIT')
    const cycling = await duration('CYCLING')
    const walking = await duration('WALKING')
    expect(transit).toBeGreaterThan(driving)
    expect(cycling).toBeGreaterThan(driving)
    expect(walking).toBeGreaterThan(cycling)
  })
  it('compares accepted friend schedules without exposing private locations', async () => {
    const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000)
    const response = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}&friendIds=user-daniel`).set('Cookie', cookie)
    const friendEvent = response.body.events.find((event: { kind: string }) => event.kind === 'FRIEND_TRIP')
    expect(friendEvent).toMatchObject({ friend: { id: 'user-daniel', name: 'Daniel' }, originLabel: 'Private origin', destinationLabel: 'Private destination' })
    expect(JSON.stringify(friendEvent)).not.toContain('Daniel’s neighbourhood')
    const untrusted = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}&friendIds=user-not-a-friend`).set('Cookie', cookie)
    expect(untrusted.body.events.some((event: { kind: string }) => event.kind === 'FRIEND_TRIP')).toBe(false)
  })
  it('matches trips when arrivals are close even if departures are not', async () => {
    const passenger = store.trips.find((trip) => trip.id === 'trip-jimmy')!
    const driver = store.trips.find((trip) => trip.id === 'trip-daniel')!
    passenger.transportationMode = 'WALKING'
    passenger.departureAt = new Date(new Date(driver.departureAt).getTime() - 50 * 60_000).toISOString()
    const matches = await store.matches('user-jimmy', passenger.id)
    expect(matches[0]).toMatchObject({ driver: { id: driver.id }, passenger: { id: passenger.id } })
    expect(Math.abs(matches[0]!.arrivalDifferenceMinutes)).toBeLessThanOrEqual(30)
  })
  it('creates a ride request and gives the driver a route comparison', async () => {
    const response = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 })
    expect(response.status).toBe(201); expect(response.body.request.status).toBe('PENDING')
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: 'user-daniel' }); const driverCookie = driverLogin.headers['set-cookie']?.[0] ?? ''
    const requests = await request(app).get('/api/ride-requests').set('Cookie', driverCookie)
    const impact = requests.body.requests[0].routeImpact
    expect(impact.originalDistanceMeters).toBeGreaterThan(0)
    expect(impact.proposedDistanceMeters).toBeGreaterThanOrEqual(impact.originalDistanceMeters)
    expect(impact.proposedArrivalAt).toBeTruthy()
    expect(impact.pickupAt).toBeTruthy()
    expect(impact.routeStops).toEqual({ from: 'Daniel’s neighbourhood', pickup: 'Burnaby area', to: 'SFU' })
    const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000)
    const calendar = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`).set('Cookie', driverCookie)
    expect(calendar.body.events.find((event: { sourceId: string }) => event.sourceId === 'trip-daniel').pendingRideRequestCount).toBe(1)
  })
  it('removes an uncommitted trip from the calendar', async () => {
    const created = await request(app).post('/api/trips').set('Cookie', cookie).send({ origin: { label: 'Home', address: 'Burnaby, BC', latitude: 49.24, longitude: -122.98 }, destination: { label: 'Gym', address: 'Burnaby, BC', latitude: 49.25, longitude: -122.96 }, departureAt: new Date(Date.now() + 86400_000).toISOString(), timezone: 'America/Vancouver', transportationMode: 'WALKING', carpoolStatus: 'NONE' })
    const tripId = created.body.trips[0].id
    expect((await request(app).delete(`/api/trips/${tripId}`).set('Cookie', cookie)).status).toBe(204)
    expect(store.trips.some((trip) => trip.id === tripId)).toBe(false)
  })
  it('lets the driver accept and returns a confirmed carpool event', async () => {
    const created = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 })
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: 'user-daniel' }); const driverCookie = driverLogin.headers['set-cookie']?.[0] ?? ''
    expect((await request(app).patch(`/api/ride-requests/${created.body.request.id}/accept`).set('Cookie', driverCookie)).body.request.status).toBe('ACCEPTED')
    const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000); const calendar = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`).set('Cookie', cookie)
    expect(calendar.body.events.some((event: { kind: string }) => event.kind === 'CONFIRMED_CARPOOL')).toBe(true)
    const plan = await request(app).get('/api/trips/trip-jimmy/route-plan').set('Cookie', cookie)
    expect(plan.body.plan.role).toBe('PASSENGER')
    expect(plan.body.plan.pickupAt).toBeTruthy()
    expect(plan.body.plan.stops.map((stop: { kind: string }) => stop.kind)).toEqual(['ORIGIN', 'PICKUP', 'DESTINATION'])
  })
  it('restores passengers and notifies them when a driver changes transport mode', async () => {
    const created = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 })
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: 'user-daniel' }); const driverCookie = driverLogin.headers['set-cookie']?.[0] ?? ''
    await request(app).patch(`/api/ride-requests/${created.body.request.id}/accept`).set('Cookie', driverCookie)
    const driverTrip = store.trips.find((trip) => trip.id === 'trip-daniel')!
    const response = await request(app).patch('/api/trips/trip-daniel').set('Cookie', driverCookie).send({ departureAt: driverTrip.departureAt, timezone: driverTrip.timezone, transportationMode: 'TRANSIT', carpoolStatus: 'NONE' })
    expect(response.status).toBe(200)
    expect(response.body.trip).toMatchObject({ transportationMode: 'TRANSIT', carpoolStatus: 'NONE' })
    expect(store.trips.find((trip) => trip.id === 'trip-jimmy')?.carpoolStatus).toBe('LOOKING_FOR_RIDE')
    expect(store.carpools).toHaveLength(0)
    expect(store.notifications.some((notification) => notification.userId === 'user-jimmy' && notification.type === 'CARPOOL_CANCELLED')).toBe(true)
  })
  it('lets a driver remove a passenger and restores the passenger trip', async () => {
    const created = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 })
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: 'user-daniel' }); const driverCookie = driverLogin.headers['set-cookie']?.[0] ?? ''
    await request(app).patch(`/api/ride-requests/${created.body.request.id}/accept`).set('Cookie', driverCookie)
    const carpoolId = store.carpools[0]!.id
    expect((await request(app).delete(`/api/carpools/${carpoolId}/passengers/trip-jimmy`).set('Cookie', driverCookie)).status).toBe(204)
    expect(store.trips.find((trip) => trip.id === 'trip-jimmy')?.carpoolStatus).toBe('LOOKING_FOR_RIDE')
    expect(store.trips.find((trip) => trip.id === 'trip-daniel')?.carpoolStatus).toBe('OFFERING_RIDE')
    expect(store.carpools).toHaveLength(0)
  })
  it('removes a confirmed passenger trip and recalculates the driver route', async () => {
    const created = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 })
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: 'user-daniel' }); const driverCookie = driverLogin.headers['set-cookie']?.[0] ?? ''
    await request(app).patch(`/api/ride-requests/${created.body.request.id}/accept`).set('Cookie', driverCookie)
    expect((await request(app).delete('/api/trips/trip-jimmy').set('Cookie', cookie)).status).toBe(204)
    expect(store.trips.some((trip) => trip.id === 'trip-jimmy')).toBe(false)
    expect(store.trips.find((trip) => trip.id === 'trip-daniel')?.carpoolStatus).toBe('OFFERING_RIDE')
    expect(store.carpools).toHaveLength(0)
  })
})
