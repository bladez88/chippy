// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LocationSearch } from './LocationSearch'

afterEach(cleanup)

describe('LocationSearch', () => {
  it('starts with an existing trip location selected for editing', () => {
    const location = { label: 'Sushi Modo', address: '7874 Edmonds St, Burnaby, BC', latitude: 49.2194, longitude: -122.9339 }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={client}><LocationSearch fieldName="originLocation" label="From" placeholder="Search" initialValue={location}/></QueryClientProvider>)
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('Sushi Modo')
    expect(container.querySelector<HTMLInputElement>('input[name="originLocation"]')?.value).toBe(JSON.stringify(location))
  })
})
