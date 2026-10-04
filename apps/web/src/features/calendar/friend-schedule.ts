import type { CalendarEvent } from '@chippy/shared'

export const FRIEND_COLORS = ['#6338c7', '#c72f68', '#00796b', '#b65300', '#1769aa', '#a33b20', '#657000', '#8b3fa0'] as const

export function colorFriendEvents(events: CalendarEvent[], selectedFriendIds: string[]) {
  const colors = new Map(selectedFriendIds.map((id, index) => [id, FRIEND_COLORS[index % FRIEND_COLORS.length]]))
  return events.map((event) => event.kind === 'FRIEND_TRIP' && event.friend
    ? { ...event, color: colors.get(event.friend.id) ?? FRIEND_COLORS[0] }
    : event)
}
