import { describe, expect, it } from 'vitest'
import { privacySafePickupLabel } from './privacy.js'

const sushiModo = {
  label: 'Sushi Modo',
  address: '7874 Edmonds St, Burnaby, BC, Canada',
  latitude: 49.2194,
  longitude: -122.9339,
}

describe('privacy-safe pickup labels', () => {
  it('reuses the driver-visible place when the pickup is at the same origin', () => {
    const nearbyPassenger = { ...sushiModo, label: "Jimmy's pickup", latitude: sushiModo.latitude + 0.0002 }
    expect(privacySafePickupLabel(sushiModo, nearbyPassenger)).toBe('Sushi Modo')
  })

  it('generalizes a passenger pickup that is away from the driver origin', () => {
    const privatePassenger = { label: 'Home', address: '123 Private St, Burnaby, BC, Canada', latitude: 49.25, longitude: -122.98 }
    expect(privacySafePickupLabel(sushiModo, privatePassenger)).toBe('Burnaby area')
  })
})
