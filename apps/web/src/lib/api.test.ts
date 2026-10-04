import { describe, expect, it } from 'vitest'
import { liveQueryOptions, queryKeys } from './api'

describe('live server-state policy', () => {
  it('refreshes active coordination data without polling hidden tabs', () => {
    expect(liveQueryOptions).toEqual({ refetchInterval: 5_000, refetchIntervalInBackground: false, refetchOnWindowFocus: 'always' })
  })

  it('uses one ride-request cache across details and notifications', () => {
    expect(queryKeys.requests).toEqual(['ride-requests'])
  })
})
