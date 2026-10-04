import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import type { CalendarEvent } from '@chippy/shared'
import { addDays, eachDayOfInterval, format, isSameMonth, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, WifiOff } from 'lucide-react'
import { api, queryKeys } from '../../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { EventCard } from './EventCard'
import { calendarHeading, isoDate, moveDate, rangeFor, sameDay, type CalendarView } from './calendar-utils'
import { TripSheet } from '../trips/TripSheet'
import { MatchSheet } from '../carpools/MatchSheet'
import { TripDetailSheet } from '../trips/TripDetailSheet'

const validView = (value: string | null): value is CalendarView => ['day','week','month'].includes(value ?? '')
export function CalendarPage() {
  const { user } = useAuth(); const [params, setParams] = useSearchParams()
  const initialView: CalendarView = validView(params.get('view')) ? params.get('view') as CalendarView : (localStorage.getItem('chippy-calendar-view') as CalendarView) || (matchMedia('(max-width: 700px)').matches ? 'day' : 'week')
  const [view, setViewState] = useState<CalendarView>(initialView); const [date, setDate] = useState(() => params.get('date') ? parseISO(params.get('date')!) : new Date())
  const [tripOpen, setTripOpen] = useState(false); const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const range = useMemo(() => rangeFor(view, date), [view, date]); const start = isoDate(range.start); const end = isoDate(range.end)
  const query = useQuery({ queryKey: queryKeys.calendar(start, end), queryFn: () => api<{ events: CalendarEvent[] }>(`/calendar?start=${start}&end=${end}&timezone=${encodeURIComponent(user!.timezone)}`) })
  const update = (nextView: CalendarView, nextDate: Date) => { setViewState(nextView); setDate(nextDate); localStorage.setItem('chippy-calendar-view', nextView); setParams({ view: nextView, date: isoDate(nextDate) }) }
  const days = eachDayOfInterval({ start: range.start, end: range.end }); const events = query.data?.events ?? []
  return <main className="page calendar-page">
    {!navigator.onLine && <div className="offline"><WifiOff/>You’re offline. Changes are paused.</div>}
    <header className="page-header"><div><p className="eyebrow">Your shared schedule</p><h1>{calendarHeading(view, date)}</h1></div><button className="avatar" aria-label="Profile">{user?.name.at(0)}</button></header>
    <div className="calendar-toolbar">
      <div className="segmented">{(['day','week','month'] as const).map((item) => <button className={view === item ? 'active' : ''} key={item} onClick={() => update(item, date)}>{item}</button>)}</div>
      <div className="date-controls"><button onClick={() => update(view, moveDate(view, date, -1))} aria-label="Previous"><ChevronLeft/></button><button className="today" onClick={() => update(view, new Date())}>Today</button><button onClick={() => update(view, moveDate(view, date, 1))} aria-label="Next"><ChevronRight/></button></div>
    </div>
    {query.isLoading && <CalendarSkeleton/>}{query.isError && <div className="empty-state"><h2>Calendar took a wrong turn</h2><p>Check the API and try again.</p><button className="button secondary" onClick={() => query.refetch()}>Retry</button></div>}
    {!query.isLoading && !query.isError && view === 'day' && <Agenda date={date} events={events} onSelect={setSelected}/>} 
    {!query.isLoading && !query.isError && view === 'week' && <Week days={days} events={events} onSelect={setSelected}/>} 
    {!query.isLoading && !query.isError && view === 'month' && <Month days={days} focus={date} events={events} onSelectDay={(day) => update('day', day)}/>} 
    <button className="fab" onClick={() => setTripOpen(true)}><Plus/>Add trip</button>
    {tripOpen && <TripSheet onClose={() => setTripOpen(false)}/>} {selected?.kind === 'POTENTIAL_MATCH' && <MatchSheet event={selected} onClose={() => setSelected(null)}/>} {selected && selected.kind !== 'POTENTIAL_MATCH' && <TripDetailSheet event={selected} onClose={() => setSelected(null)}/>} 
  </main>
}
function Agenda({ date, events, onSelect }: { date: Date; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) { const day = events.filter((event) => sameDay(event.startsAt, date)); return <section className="agenda"><div className="day-heading"><span>{format(date, 'EEEE')}</span><strong>{format(date, 'd')}</strong></div><div className="event-list">{day.length ? day.map((event) => <EventCard key={event.id} event={event} onSelect={() => onSelect(event)}/>) : <div className="empty-day"><span>Open road</span><p>No trips planned for this day.</p></div>}</div></section> }
function Week({ days, events, onSelect }: { days: Date[]; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) { return <section className="week-grid">{days.map((day) => <div className="week-day" key={day.toISOString()}><div className="week-label"><span>{format(day,'EEE')}</span><strong className={sameDay(new Date().toISOString(), day) ? 'today-dot' : ''}>{format(day,'d')}</strong></div><div>{events.filter((event) => sameDay(event.startsAt, day)).map((event) => <EventCard key={event.id} event={event} onSelect={() => onSelect(event)}/>)}</div></div>)}</section> }
function Month({ days, focus, events, onSelectDay }: { days: Date[]; focus: Date; events: CalendarEvent[]; onSelectDay: (date: Date) => void }) { return <section className="month-grid"><div className="month-weekdays">{['S','M','T','W','T','F','S'].map((d,i) => <span key={`${d}-${i}`}>{d}</span>)}</div><div className="month-days">{days.map((day) => { const count = events.filter((event) => sameDay(event.startsAt, day)).length; return <button key={day.toISOString()} className={`${!isSameMonth(day, focus) ? 'outside' : ''} ${sameDay(new Date().toISOString(), day) ? 'current' : ''}`} onClick={() => onSelectDay(day)}><span>{format(day,'d')}</span>{count > 0 && <small>{count}</small>}</button> })}</div></section> }
function CalendarSkeleton() { return <div className="skeleton-list">{[1,2,3].map((i) => <div className="skeleton" key={i}/>)}</div> }
