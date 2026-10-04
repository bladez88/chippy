import type { CalendarEvent } from '@chippy/shared'
import { describe, expect, it } from 'vitest'
import { colorFriendEvents, FRIEND_COLORS } from './friend-schedule'

const event = (id: string, friendId: string): CalendarEvent => ({ id, sourceId: id, kind: 'FRIEND_TRIP', title: 'Friend trip', subtitle: 'Private', startsAt: '2026-10-04T16:00:00.000Z', endsAt: null, transportationMode: 'DRIVING', carpoolStatus: 'NONE', friend: { id: friendId, email: `${friendId}@example.com`, name: friendId, avatarUrl: null, timezone: 'America/Vancouver' }, originLabel: 'Private origin', destinationLabel: 'Private destination', passengerCount: 0, pendingRideRequestCount: 0, color: '#000' })

describe('friend schedule colors', () => {
  it('uses one stable color per selected friend and cycles the palette', () => {
    const ids = Array.from({ length: FRIEND_COLORS.length + 1 }, (_, index) => `friend-${index}`)
    const colored = colorFriendEvents([event('one', ids[0]!), event('two', ids[0]!), event('cycled', ids.at(-1)!)], ids)
    expect(colored[0]!.color).toBe(FRIEND_COLORS[0])
    expect(colored[1]!.color).toBe(FRIEND_COLORS[0])
    expect(colored[2]!.color).toBe(FRIEND_COLORS[0])
  })
})
