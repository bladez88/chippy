import type { CalendarEvent, RideRequestDto, TripDto, TripRoutePlan } from '@chippy/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3, Copy, MapPin, Pencil, Route, Trash2, UserMinus, Users, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { api } from '../../lib/api'
import { RideRequestCard } from '../carpools/RideRequestCard'
import { TripEditForm } from './TripEditForm'

export function TripDetailSheet({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const client = useQueryClient()
  const [copied, setCopied] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const planQuery = useQuery({ queryKey: ['trip-route-plan', event.sourceId], queryFn: () => api<{ plan: TripRoutePlan }>(`/trips/${event.sourceId}/route-plan`) })
  const tripsQuery = useQuery({ queryKey: ['trips'], queryFn: () => api<{ trips: TripDto[] }>('/trips') })
  const requestsQuery = useQuery({ queryKey: ['trip-ride-requests', event.sourceId], queryFn: () => api<{ requests: RideRequestDto[] }>('/ride-requests') })
  const refresh = async (close = false) => { await client.invalidateQueries(); if (close) onClose() }
  const removeTrip = useMutation({ mutationFn: () => api<void>(`/trips/${event.sourceId}`, { method: 'DELETE' }), onSuccess: () => refresh(true) })
  const leave = useMutation({ mutationFn: (carpoolId: string) => api<void>(`/carpools/${carpoolId}/leave`, { method: 'POST' }), onSuccess: () => refresh(true) })
  const removePassenger = useMutation({ mutationFn: ({ carpoolId, tripId }: { carpoolId: string; tripId: string }) => api<void>(`/carpools/${carpoolId}/passengers/${tripId}`, { method: 'DELETE' }), onSuccess: () => refresh() })
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'accept' | 'decline' }) => api(`/ride-requests/${id}/${decision}`, { method: 'PATCH' }), onSuccess: () => refresh() })
  const plan = planQuery.data?.plan
  const trip = tripsQuery.data?.trips.find((item) => item.id === event.sourceId)
  const pendingRequests = requestsQuery.data?.requests.filter((request) => request.driverTripId === event.sourceId && request.status === 'PENDING' && request.routeImpact) ?? []
  const copyAddress = async (address: string) => { await navigator.clipboard.writeText(address); setCopied(address); window.setTimeout(() => setCopied(null), 1600) }
  const error = removeTrip.error ?? leave.error ?? removePassenger.error ?? planQuery.error

  return <div className="sheet-backdrop" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}><section className="sheet trip-detail"><div className="sheet-handle"/><header><div><p className="eyebrow">{plan?.role === 'DRIVER' ? 'You’re driving' : plan?.role === 'PASSENGER' ? `Ride with ${plan.driver.name}` : event.kind === 'CONFIRMED_CARPOOL' ? 'Confirmed carpool' : 'Your trip'}</p><h2>{format(parseISO(event.startsAt), 'EEEE, MMMM d')}</h2></div><button className="icon-button" aria-label="Close trip details" onClick={onClose}><X/></button></header>
    {(planQuery.isLoading || tripsQuery.isLoading) && <div className="route-plan-loading">Calculating your route…</div>}
    {editing && trip ? <TripEditForm trip={trip} onCancel={() => setEditing(false)} onSaved={() => refresh(true)}/> : plan && <>
      {plan.role === 'PASSENGER' && <div className="pickup-summary"><Users/><span><small>{plan.driver.name} picks you up</small><strong>{plan.pickupAt ? format(parseISO(plan.pickupAt), 'h:mm a') : 'Calculating…'}</strong></span></div>}
      {pendingRequests.length > 0 && <section className="trip-request-section"><div className="section-heading"><div><p className="eyebrow">Carpool requests</p><h3>{pendingRequests.length} pending</h3></div><span>{pendingRequests.length}</span></div>{pendingRequests.map((request) => <RideRequestCard key={request.id} request={request} isPending={decide.isPending} onDecision={(decision) => decide.mutate({ id: request.id, decision })}/>)}</section>}
      <div className="stop-timeline">{plan.stops.map((stop) => <div className={`timeline-stop ${stop.kind.toLowerCase()}`} key={`${stop.kind}-${stop.tripId ?? stop.address}`}><span className="stop-dot"><MapPin/></span><div><small>{stop.kind === 'ORIGIN' ? 'Driver starts' : stop.kind === 'PICKUP' ? `Pick up ${stop.friend?.name}` : 'Arrive'} · {format(parseISO(stop.estimatedAt), 'h:mm a')}</small><strong>{stop.label}</strong><button className="copy-address" onClick={() => copyAddress(stop.address)} title="Copy address"><span>{stop.address}</span>{copied === stop.address ? <Check/> : <Copy/>}</button></div>{plan.role === 'DRIVER' && stop.kind === 'PICKUP' && stop.tripId && <button className="remove-passenger" aria-label={`Remove ${stop.friend?.name} from carpool`} disabled={removePassenger.isPending} onClick={() => { if (window.confirm(`Remove ${stop.friend?.name} from this ride? Their original trip will be restored.`)) removePassenger.mutate({ carpoolId: plan.carpoolId!, tripId: stop.tripId! }) }}><UserMinus/></button>}</div>)}</div>
      <div className="detail-stats"><span><Clock3/><strong>{plan.durationMinutes} min</strong><small>carpool route</small></span><span><Route/><strong>{(plan.distanceMeters / 1000).toFixed(1)} km</strong><small>total distance</small></span><span><Users/><strong>{plan.stops.filter((stop) => stop.kind === 'PICKUP').length}</strong><small>passengers</small></span></div>
      {plan.role === 'PASSENGER' && <div className="arrival-comparison"><span><small>Your original arrival</small><strong>{format(parseISO(plan.originalArrivalAt), 'h:mm a')}</strong></span><i>→</i><span><small>With this carpool</small><strong>{format(parseISO(plan.carpoolArrivalAt), 'h:mm a')}</strong></span></div>}
      {error && <p className="form-error">{error.message}</p>}
      <div className="detail-actions"><button className="button secondary large" onClick={() => setEditing(true)}><Pencil/>Edit trip</button>{plan.role === 'PASSENGER' && <button className="button secondary large" disabled={leave.isPending} onClick={() => { if (window.confirm('Leave this carpool and restore your original trip?')) leave.mutate(plan.carpoolId!) }}><UserMinus/>{leave.isPending ? 'Leaving…' : 'Leave carpool'}</button>}<button className="button danger large" disabled={removeTrip.isPending} onClick={() => { const message = plan.role === 'DRIVER' ? 'Cancel this drive? Passengers will be notified and their original trips restored.' : plan.role === 'PASSENGER' ? 'Remove this trip? You will leave the carpool and it will be removed from your calendar.' : 'Remove this trip from your calendar?'; if (window.confirm(message)) removeTrip.mutate() }}><Trash2/>{removeTrip.isPending ? 'Removing…' : plan.role === 'DRIVER' ? 'Cancel drive' : 'Remove from calendar'}</button></div>
    </>}
  </section></div>
}
