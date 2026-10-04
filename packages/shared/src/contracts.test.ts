import { describe, expect, it } from 'vitest'
import { CreateTripSchema, EmailPasswordRegistrationSchema, EmailPasswordSignInSchema, transportationModes } from './index.js'

describe('shared contracts', () => {
  it('keeps transportation modes stable', () => expect(transportationModes).toEqual(['DRIVING', 'TRANSIT', 'WALKING', 'CYCLING']))
  it('rejects a non-driving ride offer', () => {
    expect(CreateTripSchema.safeParse({ origin: { label: 'A', address: 'A', latitude: 0, longitude: 0 }, destination: { label: 'B', address: 'B', latitude: 1, longitude: 1 }, departureAt: new Date().toISOString(), timezone: 'America/Vancouver', transportationMode: 'WALKING', carpoolStatus: 'OFFERING_RIDE' }).success).toBe(false)
  })
  it('normalizes email credentials at the contract boundary', () => {
    expect(EmailPasswordSignInSchema.parse({ email: '  Alex@Example.COM ', password: 'long-enough-password' }).email).toBe('alex@example.com')
  })
  it('requires a name and a password of at least ten characters for registration', () => {
    expect(EmailPasswordRegistrationSchema.safeParse({ name: '', email: 'alex@example.com', password: 'short' }).success).toBe(false)
  })
})
