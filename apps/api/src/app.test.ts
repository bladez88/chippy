import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { app } from './app.js'
import { store } from './modules/core.store.js'

describe('Chippy API vertical slice', () => {
  let cookie = ''
  beforeEach(async () => { const response = await request(app).post('/api/auth/dev-login').send({ userId: 'user-jimmy' }); cookie = response.headers['set-cookie']?.[0] ?? ''; store.requests.length = 0; store.carpools.length = 0; store.notifications.length = 0; store.trips.find((trip) => trip.id === 'trip-jimmy')!.carpoolStatus = 'LOOKING_FOR_RIDE'; store.trips.find((trip) => trip.id === 'trip-daniel')!.carpoolStatus = 'OFFERING_RIDE' })
  it('rejects unauthenticated calendar reads', async () => expect((await request(app).get('/api/calendar?start=2026-01-01&end=2026-01-31')).status).toBe(401))
  it('returns the authenticated profile', async () => expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).body.user.email).toBe('jimmy@chippy.local'))
  it('registers an account and signs it in with a normalized email', async () => {
    const email = `new-${randomUUID()}@example.com`
    const registration = await request(app).post('/api/auth/register').send({ email: ` ${email.toUpperCase()} `, name: ' New Rider ', password: 'correct horse battery staple' })
    expect(registration.status).toBe(201)
    expect(registration.body.user).toMatchObject({ email, name: 'New Rider', avatarUrl: null })
    expect(registration.body.user).not.toHaveProperty('password')
    expect(registration.body.user).not.toHaveProperty('passwordHash')
    const accountCookie = registration.headers['set-cookie']?.[0] ?? ''
    expect((await request(app).get('/api/auth/me').set('Cookie', accountCookie)).body.user.id).toBe(registration.body.user.id)
    const login = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password: 'correct horse battery staple' })
    expect(login.status).toBe(200)
    expect(login.body.user.id).toBe(registration.body.user.id)
  })
  it('rejects duplicate accounts and incorrect passwords', async () => {
    const email = `duplicate-${randomUUID()}@example.com`
    await request(app).post('/api/auth/register').send({ email, name: 'Rider', password: 'long enough password' }).expect(201)
    await request(app).post('/api/auth/register').send({ email: email.toUpperCase(), name: 'Another Rider', password: 'long enough password' }).expect(409)
    const failure = await request(app).post('/api/auth/login').send({ email, password: 'wrong password' })
    expect(failure.status).toBe(401)
    expect(failure.body.error.code).toBe('INVALID_CREDENTIALS')
  })
  it('validates account registration inputs', async () => {
    const response = await request(app).post('/api/auth/register').send({ email: 'not-an-email', name: '   ', password: 'short' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
  it('returns calendar events', async () => { const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000); const response = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`).set('Cookie', cookie); expect(response.status).toBe(200); expect(response.body.events.length).toBeGreaterThan(0) })
  it('creates a ride request from a match', async () => { const response = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 }); expect(response.status).toBe(201); expect(response.body.request.status).toBe('PENDING') })
  it('lets the driver accept and returns a confirmed carpool event', async () => {
    const created = await request(app).post('/api/ride-requests').set('Cookie', cookie).send({ driverTripId: 'trip-daniel', passengerTripId: 'trip-jimmy', fuelContributionAmount: 2 })
    const driverLogin = await request(app).post('/api/auth/dev-login').send({ userId: 'user-daniel' }); const driverCookie = driverLogin.headers['set-cookie']?.[0] ?? ''
    expect((await request(app).patch(`/api/ride-requests/${created.body.request.id}/accept`).set('Cookie', driverCookie)).body.request.status).toBe('ACCEPTED')
    const start = new Date(); const end = new Date(Date.now() + 3 * 86400_000); const calendar = await request(app).get(`/api/calendar?start=${start.toISOString().slice(0,10)}&end=${end.toISOString().slice(0,10)}`).set('Cookie', cookie)
    expect(calendar.body.events.some((event: { kind: string }) => event.kind === 'CONFIRMED_CARPOOL')).toBe(true)
  })
})
