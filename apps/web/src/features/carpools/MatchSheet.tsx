import type { CalendarEvent } from '@chippy/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, Clock3, MapPin, Route, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { api } from '../../lib/api'

export function MatchSheet({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const client = useQueryClient(); const [driverTripId, passengerTripId] = event.sourceId.split(':')
  const request = useMutation({ mutationFn: () => api('/ride-requests', { method: 'POST', body: JSON.stringify({ driverTripId, passengerTripId, fuelContributionAmount: 2 }) }), onSuccess: async () => { await client.invalidateQueries(); onClose() } })
  return <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet match-sheet"><div className="sheet-handle"/><header><div><p className="eyebrow">Potential carpool</p><h2>You’re headed the same way</h2></div><button className="icon-button" onClick={onClose}><X/></button></header>
    <div className="friend-hero"><span className="friend-avatar">{event.friend?.name.at(0)}</span><div><strong>{event.friend?.name}</strong><small>Trusted friend</small></div></div>
    <div className="match-route"><div className="route-stop"><MapPin/><span><small>Leaves</small><strong>{format(parseISO(event.startsAt), 'h:mm a')}</strong></span></div><div className="route-line"/><div className="route-stop"><Car/><span><small>Going to</small><strong>{event.title.split('→').at(-1)}</strong></span></div></div>
    <div className="match-stats"><span><Clock3/><strong>{event.detourMinutes} min</strong><small>driver detour</small></span><span><Route/><strong>{event.distanceMeters} m</strong><small>destination gap</small></span></div>
    {request.isError && <p className="form-error">{request.error.message}</p>}<button className="button primary large" disabled={request.isPending || !navigator.onLine} onClick={() => request.mutate()}>{request.isPending ? 'Sending…' : 'Request this ride · $2 suggested'}</button><p className="privacy-note">Your precise pickup is shared only after the ride is accepted.</p>
  </section></div>
}
