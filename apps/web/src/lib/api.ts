const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
export class ApiClientError extends Error { constructor(public code: string, message: string, public status: number) { super(message) } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } })
  if (!response.ok) { const payload = await response.json().catch(() => null); throw new ApiClientError(payload?.error?.code ?? 'REQUEST_FAILED', payload?.error?.message ?? 'Request failed', response.status) }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
export const queryKeys = { me: ['me'] as const, calendar: (start: string, end: string, friendIds: string[] = []) => ['calendar', start, end, [...friendIds].sort().join(',')] as const, friends: ['friends'] as const, notifications: ['notifications'] as const, requests: ['ride-requests'] as const, map: ['map'] as const }
