import { z } from 'zod'

export const transportationModes = ['DRIVING', 'TRANSIT', 'WALKING', 'CYCLING'] as const
export const carpoolStatuses = ['NONE', 'LOOKING_FOR_RIDE', 'OFFERING_RIDE', 'REQUEST_PENDING', 'MATCHED'] as const
export const rideRequestStatuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'] as const
export const friendshipStatuses = ['PENDING', 'ACCEPTED', 'BLOCKED'] as const
export const calendarEventKinds = ['OWN_TRIP', 'CONFIRMED_CARPOOL', 'POTENTIAL_MATCH'] as const

export const TransportationModeSchema = z.enum(transportationModes)
export const CarpoolStatusSchema = z.enum(carpoolStatuses)
export const RideRequestStatusSchema = z.enum(rideRequestStatuses)
export const CalendarEventKindSchema = z.enum(calendarEventKinds)
export type TransportationMode = z.infer<typeof TransportationModeSchema>
export type CarpoolStatus = z.infer<typeof CarpoolStatusSchema>
export type RideRequestStatus = z.infer<typeof RideRequestStatusSchema>
export type CalendarEventKind = z.infer<typeof CalendarEventKindSchema>

export const LocationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
export type Location = z.infer<typeof LocationSchema>

const TripBaseSchema = z.object({
  origin: LocationSchema,
  destination: LocationSchema,
  departureAt: z.iso.datetime(),
  timezone: z.string().min(1),
  transportationMode: TransportationModeSchema,
  carpoolStatus: CarpoolStatusSchema.default('NONE'),
  availableSeats: z.number().int().min(1).max(8).optional(),
})

export const CreateTripSchema = TripBaseSchema.extend({
  recurrence: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }).optional(),
}).superRefine((value, context) => {
  if (value.carpoolStatus === 'OFFERING_RIDE' && value.transportationMode !== 'DRIVING') {
    context.addIssue({ code: 'custom', path: ['carpoolStatus'], message: 'Only driving trips can offer rides' })
  }
})
export type CreateTripInput = z.infer<typeof CreateTripSchema>

export const UserSchema = z.object({
  id: z.string(), email: z.email(), name: z.string(), avatarUrl: z.string().nullable(), timezone: z.string(),
})
export type UserDto = z.infer<typeof UserSchema>

export const TripSchema = TripBaseSchema.extend({
  id: z.string(), userId: z.string(), scheduleId: z.string().nullable(), estimatedArrivalAt: z.string().nullable(),
})
export type TripDto = z.infer<typeof TripSchema>

export const CalendarEventSchema = z.object({
  id: z.string(), sourceId: z.string(), kind: CalendarEventKindSchema, title: z.string(), subtitle: z.string(),
  startsAt: z.string(), endsAt: z.string().nullable(), transportationMode: TransportationModeSchema,
  carpoolStatus: CarpoolStatusSchema, friend: UserSchema.optional(), detourMinutes: z.number().optional(),
  distanceMeters: z.number().optional(), color: z.string(),
})
export type CalendarEvent = z.infer<typeof CalendarEventSchema>

export const FriendSchema = UserSchema.extend({ friendshipId: z.string(), status: z.enum(friendshipStatuses), direction: z.enum(['INCOMING', 'OUTGOING']) })
export type FriendDto = z.infer<typeof FriendSchema>

export const RideRequestSchema = z.object({
  id: z.string(), driverTripId: z.string(), passengerTripId: z.string(), requestedByUserId: z.string(),
  requestType: z.enum(['RIDE_REQUEST', 'RIDE_OFFER']), status: z.enum(rideRequestStatuses),
  fuelContributionAmount: z.number().nonnegative().nullable(), createdAt: z.string(), friend: UserSchema,
})
export type RideRequestDto = z.infer<typeof RideRequestSchema>

export const NotificationSchema = z.object({
  id: z.string(), type: z.enum(['RIDE_REQUEST', 'RIDE_OFFER', 'RIDE_ACCEPTED', 'RIDE_DECLINED', 'CARPOOL_CANCELLED']),
  title: z.string(), body: z.string(), referenceId: z.string().nullable(), readAt: z.string().nullable(), createdAt: z.string(),
})
export type NotificationDto = z.infer<typeof NotificationSchema>

export const ApiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), fieldErrors: z.record(z.string(), z.array(z.string())).optional(), requestId: z.string() }) })
export const MATCHING_DEFAULTS = { maxDepartureDifferenceMinutes: 30, maxDestinationDistanceMeters: 2_000, maxDriverDetourMinutes: 10 } as const
