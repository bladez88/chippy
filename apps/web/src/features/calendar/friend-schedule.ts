import type { CalendarEvent } from '@chippy/shared'

export const FRIEND_COLORS = ['#6f67d9', '#d56a8a', '#2d8f83', '#d17a35', '#3978b8', '#8b6a45'] as const

export function colorFriendEvents(events: CalendarEvent[], selectedFriendIds: string[]) {
  const colors = new Map(selectedFriendIds.map((id, index) => [id, FRIEND_COLORS[index % FRIEND_COLORS.length]]))
  return events.map((event) => event.kind === 'FRIEND_TRIP' && event.friend
    ? { ...event, color: colors.get(event.friend.id) ?? FRIEND_COLORS[0] }
    : event)
}
