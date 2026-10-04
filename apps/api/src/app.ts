import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CreateTripSchema, EmailPasswordRegistrationSchema, EmailPasswordSignInSchema } from '@chippy/shared'
import { env } from './config/env.js'
import { DomainError } from './modules/core.store.js'
import { store, storeKind } from './modules/runtime.store.js'
import { issueSession, requireAuth, SESSION_COOKIE } from './middleware/auth.js'
import { verifyGoogleCredential } from './integrations/google/google-verifier.js'
import { routingService } from './integrations/routing/index.js'
import { RoutingProviderError } from './integrations/routing/routing-service.js'
import { PasswordAuthService } from './modules/auth/password-auth.service.js'
import { authRateLimit } from './middleware/auth-rate-limit.js'

export const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use((_req, res, next) => { res.locals.requestId = randomUUID(); res.setHeader('x-request-id', res.locals.requestId); next() })
const passwordAuth = new PasswordAuthService(store)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', store: storeKind }))
app.post('/api/auth/register', authRateLimit, async (req, res, next) => {
  try {
    const user = await passwordAuth.register(EmailPasswordRegistrationSchema.parse(req.body))
    issueSession(res, user.id)
    res.status(201).json({ user })
  } catch (error) { next(error) }
})
app.post('/api/auth/login', authRateLimit, async (req, res, next) => {
  try {
    const user = await passwordAuth.signIn(EmailPasswordSignInSchema.parse(req.body))
    issueSession(res, user.id)
    res.json({ user })
  } catch (error) { next(error) }
})
app.post('/api/auth/dev-login', async (req, res, next) => {
  try {
  if (!env.ENABLE_DEV_AUTH || env.NODE_ENV === 'production') return res.status(404).end()
  const parsed = z.object({ userId: z.string() }).safeParse(req.body)
  const user = parsed.success ? await store.user(parsed.data.userId) : undefined
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Demo user not found', requestId: res.locals.requestId } })
  issueSession(res, user.id); return res.json({ user })
  } catch (error) { next(error) }
})
app.post('/api/auth/google', async (req, res, next) => {
  try {
    const { credential } = z.object({ credential: z.string().min(1) }).parse(req.body)
    const google = await verifyGoogleCredential(credential)
    const user = await store.findOrCreateGoogleUser(google)
    issueSession(res, user.id); res.json({ user })
  } catch (error) { next(error) }
})
app.post('/api/auth/logout', (_req, res) => { res.clearCookie(SESSION_COOKIE, { path: '/' }); res.status(204).end() })
app.get('/api/auth/me', requireAuth, async (req, res, next) => { try { res.json({ user: await store.user(req.userId!) }) } catch (error) { next(error) } })

app.use('/api', requireAuth)
app.get('/api/trips', async (req, res, next) => { try { res.json({ trips: await store.listTrips(req.userId!) }) } catch (error) { next(error) } })
app.post('/api/trips', async (req, res, next) => { try { const trips = await store.createTrips(req.userId!, CreateTripSchema.parse(req.body)); res.status(201).json({ trips }) } catch (error) { next(error) } })
app.delete('/api/trips/:id', async (req, res, next) => { try { await store.deleteTrip(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/trips/:id/route-plan', async (req, res, next) => { try { res.json({ plan: await store.tripRoutePlan(req.userId!, req.params.id) }) } catch (error) { next(error) } })
app.post('/api/schedules', async (req, res, next) => { try { const parsed = CreateTripSchema.parse(req.body); if (!parsed.recurrence) throw new DomainError('RECURRENCE_REQUIRED', 'A recurring schedule needs recurrence dates and weekdays', 400); res.status(201).json({ trips: await store.createTrips(req.userId!, parsed) }) } catch (error) { next(error) } })
app.get('/api/trips/:id/matches', async (req, res, next) => { try { res.json({ matches: await store.matches(req.userId!, req.params.id) }) } catch (error) { next(error) } })
app.get('/api/calendar', async (req, res, next) => { try { const query = z.object({ start: z.iso.date(), end: z.iso.date(), timezone: z.string().default('America/Vancouver') }).parse(req.query); res.json({ events: await store.calendar(req.userId!, query.start, query.end, query.timezone) }) } catch (error) { next(error) } })
app.get('/api/locations/search', async (req, res, next) => { try { const query = z.object({ q: z.string().trim().min(2).max(120), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional() }).parse(req.query); const focus = query.latitude !== undefined && query.longitude !== undefined ? { latitude: query.latitude, longitude: query.longitude } : { latitude: 49.25, longitude: -122.96 }; res.json({ locations: await routingService.searchLocations(query.q, focus) }) } catch (error) { next(error) } })

app.get('/api/friends', async (req, res, next) => { try { res.json({ friends: await store.friends(req.userId!) }) } catch (error) { next(error) } })
app.post('/api/friends/requests', async (req, res, next) => { try { const { email } = z.object({ email: z.email() }).parse(req.body); await store.requestFriend(req.userId!, email); res.status(201).json({ friends: await store.friends(req.userId!) }) } catch (error) { next(error) } })
app.patch('/api/friends/requests/:id', async (req, res, next) => { try { const { status } = z.object({ status: z.enum(['ACCEPTED', 'BLOCKED']) }).parse(req.body); await store.updateFriend(req.userId!, req.params.id, status); res.json({ friends: await store.friends(req.userId!) }) } catch (error) { next(error) } })
app.delete('/api/friends/:id', async (req, res, next) => { try { await store.removeFriend(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })

app.get('/api/ride-requests', async (req, res, next) => { try { res.json({ requests: await store.rideRequests(req.userId!) }) } catch (error) { next(error) } })
app.post('/api/ride-requests', async (req, res, next) => { try { const input = z.object({ driverTripId: z.string(), passengerTripId: z.string(), fuelContributionAmount: z.number().min(0).nullable().default(null) }).parse(req.body); res.status(201).json({ request: await store.createRideRequest(req.userId!, input.driverTripId, input.passengerTripId, input.fuelContributionAmount) }) } catch (error) { next(error) } })
for (const [path, decision] of [['accept', 'ACCEPTED'], ['decline', 'DECLINED'], ['cancel', 'CANCELLED']] as const) app.patch(`/api/ride-requests/:id/${path}`, async (req, res, next) => { try { res.json({ request: await store.decideRequest(req.userId!, req.params.id, decision) }) } catch (error) { next(error) } })
app.get('/api/carpools', async (req, res, next) => { try { res.json({ carpools: await store.listCarpools(req.userId!) }) } catch (error) { next(error) } })
app.post('/api/carpools/:id/cancel', async (req, res, next) => { try { await store.cancelCarpool(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.delete('/api/carpools/:id/passengers/:tripId', async (req, res, next) => { try { await store.removePassenger(req.userId!, req.params.id, req.params.tripId); res.status(204).end() } catch (error) { next(error) } })
app.post('/api/carpools/:id/leave', async (req, res, next) => { try { await store.leaveCarpool(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/notifications', async (req, res, next) => { try { res.json({ notifications: await store.listNotifications(req.userId!) }) } catch (error) { next(error) } })
app.patch('/api/notifications/:id/read', async (req, res, next) => { try { await store.readNotification(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/map', async (req, res, next) => {
  try {
    res.json(await store.map(req.userId!, routingService))
  } catch (error) { next(error) }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof DomainError) return res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: res.locals.requestId } })
  if (error instanceof RoutingProviderError) return res.status(error.status).json({ error: { code: 'ROUTING_PROVIDER_ERROR', message: error.message, requestId: res.locals.requestId } })
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted information', fieldErrors: z.flattenError(error).fieldErrors, requestId: res.locals.requestId } })
  console.error(error)
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: res.locals.requestId } })
})
