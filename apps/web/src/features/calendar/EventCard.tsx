import type { CalendarEvent } from '@chippy/shared'
import { Car, Clock3, MapPin, Sparkles } from 'lucide-react'
import { format, parseISO } from 'date-fns'
export function EventCard({ event, onSelect }: { event: CalendarEvent; onSelect?: () => void }) {
  return <button className={`event-card ${event.kind.toLowerCase()}`} onClick={onSelect}>
    <span className="event-time">{format(parseISO(event.startsAt), 'h:mm a')}</span>
    <span className="event-icon">{event.kind === 'POTENTIAL_MATCH' ? <Sparkles/> : <Car/>}</span>
    <span className="event-copy"><strong>{event.title}</strong><small>{event.subtitle}</small></span>
    {event.detourMinutes ? <span className="event-meta"><Clock3/>{event.detourMinutes}m</span> : <span className="event-meta"><MapPin/></span>}
  </button>
}
