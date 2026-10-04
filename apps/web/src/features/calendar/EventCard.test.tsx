// @vitest-environment jsdom
import type { CalendarEvent } from '@chippy/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EventCard } from './EventCard'

afterEach(cleanup)

const confirmed: CalendarEvent = { id: 'event', sourceId: 'trip', kind: 'CONFIRMED_CARPOOL', title: 'Home → SFU', subtitle: 'Confirmed', startsAt: '2026-10-07T15:30:00.000Z', endsAt: null, transportationMode: 'TRANSIT', carpoolStatus: 'MATCHED', originLabel: 'Home', destinationLabel: 'SFU', passengerCount: 2, pendingRideRequestCount: 0, estimatedDurationMinutes: 25, color: '#167c63' }

describe('EventCard', () => {
  it('presents a confirmed ride as carpooling without a passenger-count badge', () => {
    render(<EventCard event={confirmed} onSelect={() => undefined}/>)
    expect(screen.getByText('Carpooling')).toBeTruthy()
    expect(screen.queryByText('Transit')).toBeNull()
    expect(screen.queryByText('2 passengers')).toBeNull()
  })
})
