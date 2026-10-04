import type { RideRequestDto } from '@chippy/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { api, liveQueryOptions, queryKeys } from '../../lib/api'

export function useRideRequestSync() {
  const client = useQueryClient()
  const previousSignature = useRef<string | null>(null)
  const query = useQuery({ queryKey: queryKeys.requests, queryFn: () => api<{ requests: RideRequestDto[] }>('/ride-requests'), ...liveQueryOptions })
  const signature = useMemo(() => query.data?.requests.map((request) => `${request.id}:${request.status}`).sort().join('|') ?? null, [query.data])

  useEffect(() => {
    if (signature === null) return
    if (previousSignature.current !== null && previousSignature.current !== signature) {
      void Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.calendarRoot }),
        client.invalidateQueries({ queryKey: queryKeys.trips }),
        client.invalidateQueries({ queryKey: queryKeys.tripRoutePlans }),
        client.invalidateQueries({ queryKey: queryKeys.notifications }),
        client.invalidateQueries({ queryKey: queryKeys.map }),
      ])
    }
    previousSignature.current = signature
  }, [client, signature])

  return query
}
