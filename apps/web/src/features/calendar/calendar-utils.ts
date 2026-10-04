import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, isSameYear, parseISO, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
export type CalendarView = 'day' | 'week' | 'month'
export function rangeFor(view: CalendarView, date: Date) {
  if (view === 'day') return { start: date, end: date }
  if (view === 'week') return { start: startOfWeek(date), end: endOfWeek(date) }
  return { start: startOfWeek(startOfMonth(date)), end: endOfWeek(endOfMonth(date)) }
}
export const moveDate = (view: CalendarView, date: Date, direction: 1 | -1) => view === 'day' ? (direction === 1 ? addDays(date, 1) : subDays(date, 1)) : view === 'week' ? (direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1)) : (direction === 1 ? addMonths(date, 1) : subMonths(date, 1))
export const isoDate = (date: Date) => format(date, 'yyyy-MM-dd')
export const sameDay = (iso: string, date: Date) => isoDate(parseISO(iso)) === isoDate(date)
export function calendarHeading(view: CalendarView, date: Date, abbreviated = false) {
  const month = abbreviated ? 'MMM' : 'MMMM'
  if (view === 'day') return format(date, `${month} d`)
  if (view === 'month') return format(date, `${month} yyyy`)
  const { start, end } = rangeFor('week', date)
  if (isSameMonth(start, end)) return `${format(start, `${month} d`)}–${format(end, 'd')}`
  if (isSameYear(start, end)) return `${format(start, `${month} d`)}–${format(end, `${month} d`)}`
  return `${format(start, `${month} d, yyyy`)}–${format(end, `${month} d, yyyy`)}`
}
