import type { RideRequestDto } from '@chippy/shared'
import { Check, Clock3, MapPin, Route, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export function RideRequestCard({ request, isPending, onDecision }: { request: RideRequestDto; isPending: boolean; onDecision: (decision: 'accept' | 'decline') => void }) {
  const impact = request.routeImpact
  if (!impact) return null
  return <article className="request-card request-impact">
    <header><span className="friend-avatar">{request.friend.name.at(0)}</span><div><strong>{request.friend.name} needs a ride</strong><small>Estimated pickup {format(parseISO(impact.pickupAt), 'h:mm a')} · ${request.fuelContributionAmount ?? 0} suggested</small></div></header>
    <div className="request-route"><span><small>From</small><strong>{impact.routeStops.from}</strong></span><i/><span className="pickup"><small>Pick up {request.friend.name}</small><strong>{impact.routeStops.pickup}</strong></span><i/><span><small>To</small><strong>{impact.routeStops.to}</strong></span></div>
    <div className="impact-comparison"><span><small>Current route</small><strong>{format(parseISO(impact.originalArrivalAt), 'h:mm a')}</strong><em><Clock3/>{impact.originalDurationMinutes} min <Route/>{(impact.originalDistanceMeters / 1000).toFixed(1)} km</em></span><i>→</i><span><small>With pickup</small><strong>{format(parseISO(impact.proposedArrivalAt), 'h:mm a')}</strong><em><Clock3/>{impact.proposedDurationMinutes} min <Route/>{(impact.proposedDistanceMeters / 1000).toFixed(1)} km</em></span></div>
    <p className="impact-delta"><MapPin/>Adds {impact.addedDurationMinutes} min · +{(impact.addedDistanceMeters / 1000).toFixed(1)} km</p>
    <span className="request-actions"><button className="button primary" disabled={isPending} onClick={() => onDecision('accept')}><Check/>Accept</button><button className="button secondary" disabled={isPending} onClick={() => onDecision('decline')}><X/>Decline</button></span>
  </article>
}
