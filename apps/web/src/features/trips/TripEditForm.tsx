import type { CarpoolStatus, TransportationMode, TripDto, UpdateTripInput } from '@chippy/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'

const editableStatus = (trip: TripDto): UpdateTripInput['carpoolStatus'] => trip.carpoolStatus === 'MATCHED' || trip.carpoolStatus === 'REQUEST_PENDING'
  ? trip.transportationMode === 'DRIVING' ? 'OFFERING_RIDE' : 'LOOKING_FOR_RIDE'
  : trip.carpoolStatus

export function TripEditForm({ trip, onCancel, onSaved }: { trip: TripDto; onCancel: () => void; onSaved: () => void }) {
  const client = useQueryClient()
  const [mode, setMode] = useState<TransportationMode>(trip.transportationMode)
  const [status, setStatus] = useState<UpdateTripInput['carpoolStatus']>(editableStatus(trip))
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: (body: UpdateTripInput) => api(`/trips/${trip.id}`, { method: 'PATCH', body: JSON.stringify(body) }), onSuccess: async () => { await client.invalidateQueries(); onSaved() }, onError: (reason: Error) => setError(reason.message) })
  const local = parseISO(trip.departureAt)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trip.carpoolStatus === 'MATCHED' && !window.confirm('Changing this trip will remove it from the confirmed carpool and notify the other riders. Continue?')) return
    const data = new FormData(event.currentTarget)
    const next: UpdateTripInput = {
      departureAt: new Date(`${String(data.get('date'))}T${String(data.get('time'))}`).toISOString(),
      timezone: trip.timezone,
      transportationMode: mode,
      carpoolStatus: status,
      ...(status === 'OFFERING_RIDE' ? { availableSeats: Number(data.get('availableSeats')) } : {}),
    }
    mutation.mutate(next)
  }
  const changeMode = (next: TransportationMode) => { setMode(next); if (next !== 'DRIVING' && status === 'OFFERING_RIDE') setStatus('NONE') }

  return <form className="trip-form trip-edit-form" onSubmit={submit}>
    <p className="helper">This changes only this calendar occurrence. Locations stay unchanged.</p>
    <div className="form-row date-time-row"><label>Date<input name="date" type="date" defaultValue={format(local, 'yyyy-MM-dd')} required/></label><label>Leaves at<input name="time" type="time" defaultValue={format(local, 'HH:mm')} required/></label></div>
    <div className="form-row"><label>Travel by<select value={mode} onChange={(event) => changeMode(event.target.value as TransportationMode)}><option value="DRIVING">Driving</option><option value="TRANSIT">Transit</option><option value="WALKING">Walking</option><option value="CYCLING">Cycling</option></select></label><label>Carpool<select value={status} onChange={(event) => setStatus(event.target.value as Exclude<CarpoolStatus, 'MATCHED' | 'REQUEST_PENDING'>)}><option value="NONE">Just me</option><option value="LOOKING_FOR_RIDE">Looking for a ride</option>{mode === 'DRIVING' && <option value="OFFERING_RIDE">Offering a ride</option>}</select></label></div>
    {status === 'OFFERING_RIDE' && <label>Available seats<input name="availableSeats" type="number" min="1" max="8" defaultValue={trip.availableSeats ?? 3} required/></label>}
    {trip.carpoolStatus === 'MATCHED' && <p className="edit-warning">This trip is part of a confirmed carpool. Saving changes will restore each rider’s original trip and notify them.</p>}
    {error && <p className="form-error">{error}</p>}
    <div className="detail-actions"><button type="button" className="button secondary large" onClick={onCancel}>Cancel</button><button className="button primary large" disabled={mutation.isPending || !navigator.onLine}>{mutation.isPending ? 'Saving…' : 'Save changes'}</button></div>
  </form>
}
