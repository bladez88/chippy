import type { CalendarEvent } from '@chippy/shared'
import type { CSSProperties } from 'react'
import { Bell, Bike, Bus, Car, ChevronRight, Clock3, Footprints, Sparkles, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'
export function EventCard({ event, onSelect }: { event: CalendarEvent; onSelect?: () => void }) {
  const confirmedCarpool = event.kind === 'CONFIRMED_CARPOOL'
  const pendingCarpool = event.carpoolStatus === 'REQUEST_PENDING'
  return <button className={`event-card ${event.kind.toLowerCase()}`} onClick={onSelect} disabled={!onSelect} style={{ '--event-color': event.color } as CSSProperties}>
    <span className="event-time">{format(parseISO(event.startsAt), 'h:mm a')}</span>
    <span className="event-icon">{event.kind === 'POTENTIAL_MATCH' ? <Sparkles/> : confirmedCarpool ? <Car/> : modeIcon(event.transportationMode)}</span>
    <span className="event-copy">{event.kind === 'FRIEND_TRIP' && event.friend && <strong className="friend-event-owner">{event.friend.name}</strong>}<span className="route-pair"><small>From</small><strong>{event.originLabel}</strong><i/><small>To</small><strong>{event.destinationLabel}</strong></span><span className="event-badges"><em>{confirmedCarpool ? 'Carpooling' : modeLabel(event.transportationMode)}</em>{pendingCarpool && <em className="request-badge"><Clock3/>Carpool pending</em>}{event.estimatedDurationMinutes && <em><Clock3/>~{event.estimatedDurationMinutes} min</em>}{!confirmedCarpool && event.passengerCount > 0 && <em><Users/>{event.passengerCount} passenger{event.passengerCount === 1 ? '' : 's'}</em>}{event.pendingRideRequestCount > 0 && <em className="request-badge"><Bell/>{event.pendingRideRequestCount} ride request{event.pendingRideRequestCount === 1 ? '' : 's'}</em>}{event.detourMinutes !== undefined && <em>{event.detourMinutes} min detour</em>}</span></span>
    <ChevronRight className="event-chevron"/>
  </button>
}

const modeLabel = (mode: CalendarEvent['transportationMode']) => ({ DRIVING: 'Driving', TRANSIT: 'Transit', WALKING: 'Walking', CYCLING: 'Cycling' })[mode]
const modeIcon = (mode: CalendarEvent['transportationMode']) => ({ DRIVING: <Car/>, TRANSIT: <Bus/>, WALKING: <Footprints/>, CYCLING: <Bike/> })[mode]
