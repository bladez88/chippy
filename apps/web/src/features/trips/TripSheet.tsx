import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { X } from 'lucide-react'
import { api } from '../../lib/api'

export function TripSheet({ onClose }: { onClose: () => void }) {
  const client = useQueryClient(); const tomorrow = addDays(new Date(), 1); const [recurring, setRecurring] = useState(false); const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: (body: unknown) => api('/trips', { method: 'POST', body: JSON.stringify(body) }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['calendar'] }); onClose() }, onError: (e: Error) => setError(e.message) })
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const date = String(data.get('date')); const time = String(data.get('time')); const status = String(data.get('carpoolStatus')); mutation.mutate({ origin: { label: data.get('origin'), address: data.get('origin'), latitude: 49.2488, longitude: -122.9805 }, destination: { label: data.get('destination'), address: data.get('destination'), latitude: 49.2781, longitude: -122.9199 }, departureAt: new Date(`${date}T${time}`).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, transportationMode: data.get('transportationMode'), carpoolStatus: status, availableSeats: status === 'OFFERING_RIDE' ? Number(data.get('availableSeats')) : undefined, recurrence: recurring ? { daysOfWeek: data.getAll('days').map(Number), startDate: date, endDate: data.get('endDate') } : undefined }) }
  return <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="sheet"><div className="sheet-handle"/><header><div><p className="eyebrow">Make a plan</p><h2>Add a trip</h2></div><button className="icon-button" onClick={onClose}><X/></button></header><form onSubmit={submit} className="trip-form">
    <label>From<input name="origin" required placeholder="Home"/></label><label>To<input name="destination" required placeholder="SFU, work, the gym…"/></label>
    <div className="form-row"><label>Date<input name="date" type="date" defaultValue={format(tomorrow,'yyyy-MM-dd')} required/></label><label>Leaves at<input name="time" type="time" defaultValue="08:30" required/></label></div>
    <div className="form-row"><label>Travel by<select name="transportationMode" defaultValue="DRIVING"><option value="DRIVING">Driving</option><option value="TRANSIT">Transit</option><option value="WALKING">Walking</option><option value="CYCLING">Cycling</option></select></label><label>Carpool<select name="carpoolStatus" defaultValue="NONE"><option value="NONE">Just me</option><option value="LOOKING_FOR_RIDE">Looking for a ride</option><option value="OFFERING_RIDE">Offering a ride</option></select></label></div>
    <label>Seats when offering<input name="availableSeats" type="number" min="1" max="8" defaultValue="3"/></label>
    <label className="switch-row"><span><strong>Repeat this trip</strong><small>Choose weekdays and an end date</small></span><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)}/></label>
    {recurring && <div className="recurrence"><div className="day-pills">{['S','M','T','W','T','F','S'].map((day,index) => <label key={`${day}-${index}`}><input type="checkbox" name="days" value={index} defaultChecked={[1,3,5].includes(index)}/><span>{day}</span></label>)}</div><label>Repeats until<input name="endDate" type="date" defaultValue={format(addDays(tomorrow, 30),'yyyy-MM-dd')} required/></label></div>}
    {error && <p className="form-error">{error}</p>}<button className="button primary large" disabled={mutation.isPending || !navigator.onLine}>{mutation.isPending ? 'Saving…' : 'Add to calendar'}</button>
  </form></section></div>
}
