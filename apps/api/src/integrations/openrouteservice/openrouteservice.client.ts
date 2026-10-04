import type { Location, TransportationMode } from '@chippy/shared'
import type { LocationSuggestion, RouteResult, RoutingService } from '../routing/routing-service.js'
import { RoutingProviderError } from '../routing/routing-service.js'

const profile: Record<TransportationMode, string> = { DRIVING: 'driving-car', TRANSIT: 'driving-car', WALKING: 'foot-walking', CYCLING: 'cycling-regular' }
const TRANSIT_ROAD_TIME_MULTIPLIER = 1.35
const TRANSIT_WAIT_SECONDS = 8 * 60
type CacheEntry<T> = { expiresAt: number; value: T }

export class OpenRouteServiceClient implements RoutingService {
  private cache = new Map<string, CacheEntry<unknown>>()
  constructor(private apiKey: string, private baseUrl = 'https://api.openrouteservice.org') {}

  async searchLocations(query: string, focus?: { latitude: number; longitude: number }): Promise<LocationSuggestion[]> {
    const params = new URLSearchParams({ text: query, size: '5', 'boundary.country': 'CA' })
    if (focus) { params.set('focus.point.lat', String(focus.latitude)); params.set('focus.point.lon', String(focus.longitude)) }
    const data = await this.request<{ features: Array<{ properties: { id?: string; label: string; name?: string }; geometry: { coordinates: [number, number] } }> }>(`/geocode/search?${params}`)
    return data.features.map((feature, index) => ({ id: feature.properties.id ?? `${feature.geometry.coordinates.join(':')}:${index}`, label: feature.properties.name ?? feature.properties.label.split(',')[0]!, address: feature.properties.label, longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] }))
  }

  async getRoute(stops: Location[], mode: TransportationMode): Promise<RouteResult> {
    if (stops.length < 2) throw new RoutingProviderError('A route requires at least two stops', 400)
    const body = { coordinates: stops.map((stop) => [stop.longitude, stop.latitude]) }
    const data = await this.request<{ features: Array<{ properties: { summary: { distance: number; duration: number }; segments?: Array<{ distance: number; duration: number }> }; geometry: { coordinates: [number, number][] } }> }>(`/v2/directions/${profile[mode]}/geojson`, { method: 'POST', body: JSON.stringify(body) })
    const route = data.features[0]
    if (!route) throw new RoutingProviderError('No route was found for those locations', 422)
    const legs = route.properties.segments?.map((segment) => ({ distanceMeters: segment.distance, durationSeconds: segment.duration })) ?? [{ distanceMeters: route.properties.summary.distance, durationSeconds: route.properties.summary.duration }]
    const result = { distanceMeters: route.properties.summary.distance, durationSeconds: route.properties.summary.duration, geometry: route.geometry.coordinates, legs }
    return mode === 'TRANSIT' ? estimateTransitRoute(result) : result
  }

  async getMatrix(locations: Location[], mode: TransportationMode) {
    const data = await this.request<{ distances: number[][]; durations: number[][] }>(`/v2/matrix/${profile[mode]}`, { method: 'POST', body: JSON.stringify({ locations: locations.map((location) => [location.longitude, location.latitude]), metrics: ['distance', 'duration'] }) })
    return { distances: data.distances, durations: mode === 'TRANSIT' ? data.durations.map((row) => row.map((seconds) => seconds > 0 ? estimateTransitDurationSeconds(seconds) : seconds)) : data.durations }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const cacheKey = `${init.method ?? 'GET'}:${path}:${init.body ?? ''}`; const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined
    if (cached && cached.expiresAt > Date.now()) return cached.value
    let response: Response
    try { response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(12_000), headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', ...init.headers } }) }
    catch { throw new RoutingProviderError('The routing service is temporarily unavailable') }
    if (!response.ok) { const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null; throw new RoutingProviderError(detail?.error?.message ?? `Routing provider returned ${response.status}`, response.status === 429 ? 429 : 502) }
    const value = await response.json() as T; this.cache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60_000 }); return value
  }
}

export const estimateTransitDurationSeconds = (roadDurationSeconds: number) => Math.round(roadDurationSeconds * TRANSIT_ROAD_TIME_MULTIPLIER + TRANSIT_WAIT_SECONDS)

function estimateTransitRoute(route: RouteResult): RouteResult {
  const adjustedLegs = route.legs.map((leg) => ({ ...leg, durationSeconds: Math.round(leg.durationSeconds * TRANSIT_ROAD_TIME_MULTIPLIER) }))
  if (adjustedLegs[0]) adjustedLegs[0] = { ...adjustedLegs[0], durationSeconds: adjustedLegs[0].durationSeconds + TRANSIT_WAIT_SECONDS }
  return { ...route, durationSeconds: adjustedLegs.reduce((sum, leg) => sum + leg.durationSeconds, 0), legs: adjustedLegs }
}
