import { describe, expect, it } from 'vitest'
import { estimateTransitDurationSeconds } from './openrouteservice.client.js'

describe('OpenRouteService transit estimate', () => {
  it('adds transfer/wait overhead to the road duration', () => {
    expect(estimateTransitDurationSeconds(600)).toBe(1_290)
    expect(estimateTransitDurationSeconds(1_200)).toBe(2_100)
  })
})
