import { describe,expect,it } from 'vitest'
import { calendarHeading, rangeFor } from './calendar-utils'

describe('calendar ranges', () => {
  it('builds a seven day week', () => {
    const range = rangeFor('week', new Date(2026, 9, 7))
    expect(Math.round((range.end.getTime() - range.start.getTime()) / 86400000)).toBe(7)
  })

  it('labels a week using its complete visible range', () => {
    expect(calendarHeading('week', new Date(2026, 9, 7))).toBe('Oct 4–10')
  })

  it('includes both months when a week crosses a month boundary', () => {
    expect(calendarHeading('week', new Date(2026, 8, 30))).toBe('Sep 27–Oct 3')
  })
})
