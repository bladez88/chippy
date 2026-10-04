import { describe, expect, it } from 'vitest'
import { CreateTripSchema, EmailPasswordRegistrationSchema, EmailPasswordSignInSchema, UpdateTripSchema, isTimingCompatible, transportationModes } from './index.js'

describe('shared contracts', () => {
  it('keeps transportation modes stable', () => expect(transportationModes).toEqual(['DRIVING', 'TRANSIT', 'WALKING', 'CYCLING']))
  it('rejects a non-driving ride offer', () => {
    expect(CreateTripSchema.safeParse({ origin: { label: 'A', address: 'A', latitude: 0, longitude: 0 }, destination: { label: 'B', address: 'B', latitude: 1, longitude: 1 }, departureAt: new Date().toISOString(), timezone: 'America/Vancouver', transportationMode: 'WALKING', carpoolStatus: 'OFFERING_RIDE' }).success).toBe(false)
  })
  it('applies the same ride-offer invariant to trip edits', () => {
    expect(UpdateTripSchema.safeParse({ departureAt: new Date().toISOString(), timezone: 'America/Vancouver', transportationMode: 'TRANSIT', carpoolStatus: 'OFFERING_RIDE', availableSeats: 2 }).success).toBe(false)
  })
  it('accepts validated origin and destination snapshots for trip edits', () => {
    const location = { label: 'Sushi Modo', address: '7874 Edmonds St, Burnaby, BC', latitude: 49.2194, longitude: -122.9339 }
    expect(UpdateTripSchema.safeParse({ origin: location, destination: { ...location, label: 'SFU' }, departureAt: new Date().toISOString(), timezone: 'America/Vancouver', transportationMode: 'DRIVING', carpoolStatus: 'NONE' }).success).toBe(true)
  })
  it('normalizes email credentials at the contract boundary', () => {
    expect(EmailPasswordSignInSchema.parse({ email: '  Alex@Example.COM ', password: 'long-enough-password' }).email).toBe('alex@example.com')
  })
  it('requires a name and a password of at least ten characters for registration', () => {
    expect(EmailPasswordRegistrationSchema.safeParse({ name: '', email: 'alex@example.com', password: 'short' }).success).toBe(false)
  })
  it('accepts timing when departures or arrivals are close enough', () => {
    expect(isTimingCompatible(20, 45)).toBe(true)
    expect(isTimingCompatible(50, 20)).toBe(true)
    expect(isTimingCompatible(50, -20)).toBe(true)
    expect(isTimingCompatible(50, 45)).toBe(false)
  })
})
