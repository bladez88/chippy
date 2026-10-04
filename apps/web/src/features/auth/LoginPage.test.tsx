// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LoginPage } from './LoginPage'

const auth = vi.hoisted(() => ({
  loginDemo: vi.fn(),
  loginGoogle: vi.fn(),
  loginPassword: vi.fn().mockResolvedValue(undefined),
  registerPassword: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./AuthProvider', () => ({ useAuth: () => auth }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('signs in with email and password', async () => {
    const { container } = render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse-battery-staple' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(auth.loginPassword).toHaveBeenCalledWith({ email: 'alex@example.com', password: 'correct-horse-battery-staple' }))
  })

  it('creates a regular account from the same screen', async () => {
    const { container } = render(<LoginPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex Chen' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse-battery-staple' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(auth.registerPassword).toHaveBeenCalledWith({ name: 'Alex Chen', email: 'alex@example.com', password: 'correct-horse-battery-staple' }))
  })
})
