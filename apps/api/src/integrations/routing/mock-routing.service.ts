import type { Location, TransportationMode } from '@chippy/shared'
import type { LocationSuggestion, RouteResult, RoutingService } from './routing-service.js'

const fixtures: LocationSuggestion[] = [
  { id: 'sfu', label: 'Simon Fraser University', address: '8888 University Drive, Burnaby, BC', latitude: 49.277662, longitude: -122.909535 },
  { id: 'metrotown', label: 'Metrotown', address: '4700 Kingsway, Burnaby, BC', latitude: 49.22698, longitude: -123.00061 },
  { id: 'downtown', label: 'Downtown Vancouver', address: 'Vancouver, BC', latitude: 49.2827, longitude: -123.1207 },
]

export class MockRoutingService implements RoutingService {
  async searchLocations(query: string) { const value = query.toLowerCase(); return fixtures.filter((item) => `${item.label} ${item.address}`.toLowerCase().includes(value)).slice(0, 5) }
  async getRoute(stops: Location[], mode: TransportationMode): Promise<RouteResult> {
    const speed = { DRIVING: 9.6, TRANSIT: 7, CYCLING: 4.5, WALKING: 1.35 }[mode]
    const legs = stops.slice(1).map((stop, index) => { const distanceMeters = haversine(stops[index]!, stop); return { distanceMeters, durationSeconds: distanceMeters / speed + (mode === 'TRANSIT' && index === 0 ? 8 * 60 : 0) } })
    const distanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0)
    return { distanceMeters, durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0), geometry: stops.map((stop) => [stop.longitude, stop.latitude]), legs }
  }
  async getMatrix(locations: Location[], mode: TransportationMode) {
    const rows = await Promise.all(locations.map(async (from) => Promise.all(locations.map((to) => this.getRoute([from, to], mode)))))
    return { distances: rows.map((row) => row.map((route) => route.distanceMeters)), durations: rows.map((row) => row.map((route) => route.durationSeconds)) }
  }
}

function haversine(a: Location, b: Location) { const rad = (value: number) => value * Math.PI / 180; const dLat = rad(b.latitude-a.latitude); const dLng = rad(b.longitude-a.longitude); const h = Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLng/2)**2; return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)) }
