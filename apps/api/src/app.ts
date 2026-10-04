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
import { routingService } from './integrations/routing/index.js'
import { RoutingProviderError } from './integrations/routing/routing-service.js'

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
app.delete('/api/trips/:id', (req, res, next) => { try { store.deleteTrip(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/trips/:id/route-plan', async (req, res, next) => { try { res.json({ plan: await store.tripRoutePlan(req.userId!, req.params.id) }) } catch (error) { next(error) } })
app.post('/api/schedules', (req, res, next) => { try { const parsed = CreateTripSchema.parse(req.body); if (!parsed.recurrence) throw new DomainError('RECURRENCE_REQUIRED', 'A recurring schedule needs recurrence dates and weekdays', 400); res.status(201).json({ trips: store.createTrips(req.userId!, parsed) }) } catch (error) { next(error) } })
app.get('/api/trips/:id/matches', async (req, res, next) => { try { res.json({ matches: await store.matches(req.userId!, req.params.id) }) } catch (error) { next(error) } })
app.get('/api/calendar', async (req, res, next) => { try { const query = z.object({ start: z.iso.date(), end: z.iso.date(), timezone: z.string().default('America/Vancouver') }).parse(req.query); res.json({ events: await store.calendar(req.userId!, query.start, query.end) }) } catch (error) { next(error) } })
app.get('/api/locations/search', async (req, res, next) => { try { const query = z.object({ q: z.string().trim().min(2).max(120), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional() }).parse(req.query); const focus = query.latitude !== undefined && query.longitude !== undefined ? { latitude: query.latitude, longitude: query.longitude } : { latitude: 49.25, longitude: -122.96 }; res.json({ locations: await routingService.searchLocations(query.q, focus) }) } catch (error) { next(error) } })

app.get('/api/friends', (req, res) => res.json({ friends: store.friends(req.userId!) }))
app.post('/api/friends/requests', (req, res, next) => { try { const { email } = z.object({ email: z.email() }).parse(req.body); store.requestFriend(req.userId!, email); res.status(201).json({ friends: store.friends(req.userId!) }) } catch (error) { next(error) } })
app.patch('/api/friends/requests/:id', (req, res, next) => { try { const { status } = z.object({ status: z.enum(['ACCEPTED', 'BLOCKED']) }).parse(req.body); store.updateFriend(req.userId!, req.params.id, status); res.json({ friends: store.friends(req.userId!) }) } catch (error) { next(error) } })
app.delete('/api/friends/:id', (req, res, next) => { try { store.removeFriend(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })

app.get('/api/ride-requests', async (req, res, next) => { try { res.json({ requests: await store.rideRequests(req.userId!) }) } catch (error) { next(error) } })
app.post('/api/ride-requests', async (req, res, next) => { try { const input = z.object({ driverTripId: z.string(), passengerTripId: z.string(), fuelContributionAmount: z.number().min(0).nullable().default(null) }).parse(req.body); res.status(201).json({ request: await store.createRideRequest(req.userId!, input.driverTripId, input.passengerTripId, input.fuelContributionAmount) }) } catch (error) { next(error) } })
for (const [path, decision] of [['accept', 'ACCEPTED'], ['decline', 'DECLINED'], ['cancel', 'CANCELLED']] as const) app.patch(`/api/ride-requests/:id/${path}`, (req, res, next) => { try { res.json({ request: store.decideRequest(req.userId!, req.params.id, decision) }) } catch (error) { next(error) } })
app.get('/api/carpools', (req, res) => res.json({ carpools: store.carpools.filter((carpool) => { const driver = store.trips.find((trip) => trip.id === carpool.driverTripId); return driver?.userId === req.userId || carpool.participantTripIds.some((id) => store.trips.find((trip) => trip.id === id)?.userId === req.userId) }) }))
app.post('/api/carpools/:id/cancel', (req, res, next) => { try { store.cancelCarpool(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.delete('/api/carpools/:id/passengers/:tripId', (req, res, next) => { try { store.removePassenger(req.userId!, req.params.id, req.params.tripId); res.status(204).end() } catch (error) { next(error) } })
app.post('/api/carpools/:id/leave', (req, res, next) => { try { store.leaveCarpool(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/notifications', (req, res) => res.json({ notifications: store.listNotifications(req.userId!) }))
app.patch('/api/notifications/:id/read', (req, res, next) => { try { store.readNotification(req.userId!, req.params.id); res.status(204).end() } catch (error) { next(error) } })
app.get('/api/map', async (req, res, next) => {
  try {
    const own = store.trips.filter((trip) => trip.userId === req.userId && new Date(trip.departureAt).getTime() >= Date.now()).sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    const features = await Promise.all(own.map(async (trip) => {
      const plan = store.routePlan(trip); const routeMode = plan.driverTrip.transportationMode === 'TRANSIT' ? 'DRIVING' : plan.driverTrip.transportationMode; const route = await routingService.getRoute(plan.stops, routeMode)
      const stops = [{ kind: 'ORIGIN', label: plan.driverTrip.origin.label, address: plan.driverTrip.origin.address, latitude: plan.driverTrip.origin.latitude, longitude: plan.driverTrip.origin.longitude, friendName: store.user(plan.driverTrip.userId)?.name }, ...plan.passengers.map((passenger) => ({ kind: 'PICKUP', label: `${store.user(passenger.userId)?.name}'s pickup`, address: passenger.origin.address, latitude: passenger.origin.latitude, longitude: passenger.origin.longitude, friendName: store.user(passenger.userId)?.name })), { kind: 'DESTINATION', label: plan.driverTrip.destination.label, address: plan.driverTrip.destination.address, latitude: plan.driverTrip.destination.latitude, longitude: plan.driverTrip.destination.longitude, friendName: null }]
      return { type: 'Feature', id: trip.id, properties: { title: `${plan.driverTrip.origin.label} → ${plan.driverTrip.destination.label}`, originLabel: plan.driverTrip.origin.label, destinationLabel: plan.driverTrip.destination.label, status: trip.carpoolStatus, departureAt: trip.departureAt, transportationMode: routeMode, passengerCount: plan.passengers.length, distanceMeters: Math.round(route.distanceMeters), durationSeconds: Math.round(route.durationSeconds), stops }, geometry: { type: 'LineString', coordinates: route.geometry } }
    }))
    res.json({ type: 'FeatureCollection', features })
  } catch (error) { next(error) }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof DomainError) return res.status(error.status).json({ error: { code: error.code, message: error.message, requestId: res.locals.requestId } })
  if (error instanceof RoutingProviderError) return res.status(error.status).json({ error: { code: 'ROUTING_PROVIDER_ERROR', message: error.message, requestId: res.locals.requestId } })
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted information', fieldErrors: z.flattenError(error).fieldErrors, requestId: res.locals.requestId } })
  console.error(error)
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: res.locals.requestId } })
})
