import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CreateTripSchema } from '@chippy/shared'
import { env } from './config/env.js'
import { DomainError, store } from './modules/core.store.js'
import { issueSession, requireAuth, SESSION_COOKIE } from './middleware/auth.js'
import { verifyGoogleCredential } from './integrations/google/google-verifier.js'

export const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use((_req, res, next) => { res.locals.requestId = randomUUID(); res.setHeader('x-request-id', res.locals.requestId); next() })

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.post('/api/auth/dev-login', (req, res) => {
  if (!env.ENABLE_DEV_AUTH || env.NODE_ENV === 'production') return res.status(404).end()
  const parsed = z.object({ userId: z.string() }).safeParse(req.body)
  const user = parsed.success ? store.user(parsed.data.userId) : undefined
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Demo user not found', requestId: res.locals.requestId } })
  issueSession(res, user.id); return res.json({ user })
})
app.post('/api/auth/google', async (req, res, next) => {
  try {
    const { credential } = z.object({ credential: z.string().min(1) }).parse(req.body)
    const google = await verifyGoogleCredential(credential)
    let user = store.users.find((item) => item.email === google.email)
    if (!user) { user = { id: randomUUID(), email: google.email, name: google.name, avatarUrl: google.avatarUrl, timezone: 'America/Vancouver' }; store.users.push(user) }
    issueSession(res, user.id); res.json({ user })
  } catch (error) { next(error) }
})
app.post('/api/auth/logout', (_req, res) => { res.clearCookie(SESSION_COOKIE, { path: '/' }); res.status(204).end() })
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: store.user(req.userId!) }))

app.use('/api', requireAuth)
app.get('/api/trips', (req, res) => res.json({ trips: store.trips.filter((trip) => trip.userId === req.userId) }))
app.post('/api/trips', (req, res, next) => { try { const trips = store.createTrips(req.userId!, CreateTripSchema.parse(req.body)); res.status(201).json({ trips }) } catch (error) { next(error) } })
app.post('/api/schedules', (req, res, next) => { try { const parsed = CreateTripSchema.parse(req.body); if (!parsed.recurrence) throw new DomainError('RECURRENCE_REQUIRED', 'A recurring schedule needs recurrence dates and weekdays', 400); res.status(201).json({ trips: store.createTrips(req.userId!, parsed) }) } catch (error) { next(error) } })
app.get('/api/trips/:id/matches', (req, res, next) => { try { res.json({ matches: store.matches(req.userId!, req.params.id) }) } catch (error) { next(error) } })
app.get('/api/calendar', (req, res, next) => { try { const query = z.object({ start: z.iso.date(), end: z.iso.date(), timezone: z.string().default('America/Vancouver') }).parse(req.query); res.json({ events: store.calendar(req.userId!, query.start, query.end) }) } catch (error) { next(error) } })

app.get('/api/friends', (req, res) => res.json({ friends: store.friends(req.userId!) }))
app.post('/api/friends/requests', (req, res, next) => { try { const { email } = z.object({ email: z.email() }).parse(req.body); store.requestFriend(req.userId!, email); res.status(201).json({ friends: store.friends(req.userId!) }) } catch (error) { next(error) } })
app.patch('/api/friends/requests/:id', (req, res, next) => { try { const { status } = z.object({ status: z.enum(['ACCEPTED', 'BLOCKED']) }).parse(req.body); store.updateFriend(req.userId!, req.params.id, status); res.json({ friends: store.friends(req.userId!) }) } catch (error) { next(error) } })
app.delete('/api/friends/:id', (req, res, next) => { try { store.removeFriend(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })

app.get('/api/ride-requests', (req, res) => res.json({ requests: store.rideRequests(req.userId!) }))
app.post('/api/ride-requests', (req, res, next) => { try { const input = z.object({ driverTripId: z.string(), passengerTripId: z.string(), fuelContributionAmount: z.number().min(0).nullable().default(null) }).parse(req.body); res.status(201).json({ request: store.createRideRequest(req.userId!, input.driverTripId, input.passengerTripId, input.fuelContributionAmount) }) } catch (error) { next(error) } })
for (const [path, decision] of [['accept', 'ACCEPTED'], ['decline', 'DECLINED'], ['cancel', 'CANCELLED']] as const) app.patch(`/api/ride-requests/:id/${path}`, (req, res, next) => { try { res.json({ request: store.decideRequest(req.userId!, req.params.id, decision) }) } catch (error) { next(error) } })
app.get('/api/carpools', (req, res) => res.json({ carpools: store.carpools.filter((carpool) => { const driver = store.trips.find((trip) => trip.id === carpool.driverTripId); return driver?.userId === req.userId || carpool.participantTripIds.some((id) => store.trips.find((trip) => trip.id === id)?.userId === req.userId) }) }))
app.get('/api/notifications', (req, res) => res.json({ notifications: store.listNotifications(req.userId!) }))
app.patch('/api/notifications/:id/read', (req, res, next) => { try { store.readNotification(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/map', (req, res) => {
  const own = store.trips.filter((trip) => trip.userId === req.userId)
  res.json({ type: 'FeatureCollection', features: own.map((trip) => ({ type: 'Feature', id: trip.id, properties: { title: `${trip.origin.label} → ${trip.destination.label}`, status: trip.carpoolStatus, departureAt: trip.departureAt }, geometry: { type: 'LineString', coordinates: [[trip.origin.longitude, trip.origin.latitude], [trip.destination.longitude, trip.destination.latitude]] } })) })
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof DomainError) return res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: res.locals.requestId } })
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted information', fieldErrors: z.flattenError(error).fieldErrors, requestId: res.locals.requestId } })
  console.error(error)
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: res.locals.requestId } })
})
