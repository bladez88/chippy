import { createContext, useContext, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UserDto } from '@chippy/shared'
import { api, queryKeys } from '../../lib/api'

type Credentials = { email: string; password: string }
type Registration = Credentials & { name: string }
type AuthValue = { user: UserDto | null; loading: boolean; register: (input: Registration) => Promise<void>; loginWithPassword: (input: Credentials) => Promise<void>; login: (id: string) => Promise<void>; loginGoogle: (credential: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => api<{ user: UserDto }>('/auth/me'), retry: false })
  const registerMutation = useMutation({ mutationFn: (input: Registration) => api<{ user: UserDto }>('/auth/register', { method: 'POST', body: JSON.stringify(input) }), onSuccess: (data) => client.setQueryData(queryKeys.me, data) })
  const passwordLoginMutation = useMutation({ mutationFn: (input: Credentials) => api<{ user: UserDto }>('/auth/login', { method: 'POST', body: JSON.stringify(input) }), onSuccess: (data) => client.setQueryData(queryKeys.me, data) })
  const loginMutation = useMutation({ mutationFn: (userId: string) => api<{ user: UserDto }>('/auth/dev-login', { method: 'POST', body: JSON.stringify({ userId }) }), onSuccess: (data) => client.setQueryData(queryKeys.me, data) })
  const googleMutation = useMutation({ mutationFn: (credential: string) => api<{ user: UserDto }>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }), onSuccess: (data) => client.setQueryData(queryKeys.me, data) })
  const logoutMutation = useMutation({ mutationFn: () => api<void>('/auth/logout', { method: 'POST' }), onSuccess: () => { client.clear() } })
  return <AuthContext.Provider value={{
    user: me.data?.user ?? null,
    loading: me.isLoading,
    register: async (input) => { await registerMutation.mutateAsync(input) },
    loginWithPassword: async (input) => { await passwordLoginMutation.mutateAsync(input) },
    login: async (id) => { await loginMutation.mutateAsync(id) },
    loginGoogle: async (credential) => { await googleMutation.mutateAsync(credential) },
    logout: async () => { await logoutMutation.mutateAsync() },
  }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider missing'); return value }
