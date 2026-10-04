import type { Location, TransportationMode } from '@chippy/shared'

export type RouteResult = {
  distanceMeters: number
  durationSeconds: number
  geometry: [number, number][]
  legs: { distanceMeters: number; durationSeconds: number }[]
}

export type LocationSuggestion = Location & { id: string }

export interface RoutingService {
  searchLocations(query: string, focus?: { latitude: number; longitude: number }): Promise<LocationSuggestion[]>
  getRoute(stops: Location[], mode: TransportationMode): Promise<RouteResult>
  getMatrix(locations: Location[], mode: TransportationMode): Promise<{ distances: number[][]; durations: number[][] }>
}

export class RoutingProviderError extends Error {
  constructor(message: string, public status = 502) { super(message) }
}
