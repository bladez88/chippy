import { describe,expect,it } from 'vitest'
import { calendarHeading, rangeFor } from './calendar-utils'

describe('calendar ranges', () => {
  it('builds a seven day week', () => {
    const range = rangeFor('week', new Date(2026, 9, 7))
    expect(Math.round((range.end.getTime() - range.start.getTime()) / 86400000)).toBe(7)
  })

  it('labels a week using its complete visible range', () => {
    expect(calendarHeading('week', new Date(2026, 9, 7))).toBe('October 4–10')
    expect(calendarHeading('week', new Date(2026, 9, 7), true)).toBe('Oct 4–10')
  })

  it('includes both months when a week crosses a month boundary', () => {
    expect(calendarHeading('week', new Date(2026, 8, 30))).toBe('September 27–October 3')
    expect(calendarHeading('week', new Date(2026, 8, 30), true)).toBe('Sep 27–Oct 3')
  })

  it('abbreviates day and month headings only when requested', () => {
    expect(calendarHeading('day', new Date(2026, 9, 4))).toBe('October 4')
    expect(calendarHeading('day', new Date(2026, 9, 4), true)).toBe('Oct 4')
    expect(calendarHeading('month', new Date(2026, 9, 4))).toBe('October 2026')
    expect(calendarHeading('month', new Date(2026, 9, 4), true)).toBe('Oct 2026')
  })
})
