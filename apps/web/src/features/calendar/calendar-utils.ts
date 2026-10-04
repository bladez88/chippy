import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns'
export type CalendarView = 'day' | 'week' | 'month'
export function rangeFor(view: CalendarView, date: Date) {
  if (view === 'day') return { start: date, end: date }
  if (view === 'week') return { start: startOfWeek(date), end: endOfWeek(date) }
  return { start: startOfWeek(startOfMonth(date)), end: endOfWeek(endOfMonth(date)) }
}
export const moveDate = (view: CalendarView, date: Date, direction: 1 | -1) => view === 'day' ? (direction === 1 ? addDays(date, 1) : subDays(date, 1)) : view === 'week' ? (direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1)) : (direction === 1 ? addMonths(date, 1) : subMonths(date, 1))
export const isoDate = (date: Date) => format(date, 'yyyy-MM-dd')
export const sameDay = (iso: string, date: Date) => isoDate(parseISO(iso)) === isoDate(date)
