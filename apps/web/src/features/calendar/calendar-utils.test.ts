import { describe,expect,it } from 'vitest'
import { rangeFor } from './calendar-utils'
describe('calendar ranges',()=>{it('builds a seven day week',()=>{const range=rangeFor('week',new Date(2026,9,3));expect(Math.round((range.end.getTime()-range.start.getTime())/86400000)).toBe(7)})})
