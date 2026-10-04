import { useQuery } from '@tanstack/react-query'
import { MapContainer, Polyline, TileLayer } from 'react-leaflet'
import { MapPin, Navigation } from 'lucide-react'
import { api, queryKeys } from '../../lib/api'
import 'leaflet/dist/leaflet.css'

type MapData = { type: 'FeatureCollection'; features: Array<{ id: string; properties: { title: string; status: string; departureAt: string }; geometry: { type: 'LineString'; coordinates: [number, number][] } }> }
export function MapPage() {
  const query = useQuery({ queryKey: queryKeys.map, queryFn: () => api<MapData>('/map') })
  return <main className="page map-page"><header className="page-header map-header"><div><p className="eyebrow">Routes nearby</p><h1>Trip map</h1></div><button className="icon-button"><Navigation/></button></header>
    <div className="map-filters"><button className="active">My trips</button><button>Friends</button><button>This week</button></div>
    <section className="map-wrap">{query.isLoading ? <div className="map-loading">Loading routes…</div> : query.isError ? <div className="empty-state">Couldn’t load the map.</div> : <MapContainer center={[49.258, -122.955]} zoom={12} zoomControl={false}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"/>{query.data?.features.map((feature) => <Polyline key={feature.id} positions={feature.geometry.coordinates.map(([lng,lat]) => [lat,lng])} pathOptions={{ color: feature.properties.status === 'MATCHED' ? '#167c63' : '#5c69d8', weight: 5, opacity: .82 }}/>)}</MapContainer>}</section>
    <section className="map-card"><span className="event-icon"><MapPin/></span><div><strong>{query.data?.features.length ?? 0} upcoming routes</strong><small>Only confirmed riders see precise pickup details.</small></div></section>
  </main>
}
