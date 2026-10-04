import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { ApiClientError } from '../../lib/api'

export function LoginPage() {
  const { loginDemo, loginGoogle, loginPassword, registerPassword } = useAuth()
  const googleRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const demoEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_AUTH !== 'false'
  const [mode, setMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!googleClientId) return
    const render = () => {
      window.google?.accounts.id.initialize({ client_id: googleClientId, callback: ({ credential }) => void loginGoogle(credential).catch(() => setError('Google sign-in could not be completed.')) })
      if (googleRef.current) window.google?.accounts.id.renderButton(googleRef.current, { theme: 'outline', size: 'large', shape: 'pill', width: 360 })
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
    if (existing) { render(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.googleIdentity = 'true'
    script.onload = render
    document.head.appendChild(script)
  }, [googleClientId, loginGoogle])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    try {
      if (mode === 'REGISTER') await registerPassword({ name: String(data.get('name') ?? ''), email, password })
      else await loginPassword({ email, password })
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : 'We could not complete that request. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="login-page">
    <div className="brand"><img className="brand-mark" src="/chippy-icon-192.png" alt=""/><span>chippy</span></div>
    <section className="login-card">
      <div className="eyebrow">Carpools, minus the group chat chaos</div>
      <h1>Going the same way?</h1>
      <p className="lead">Share your schedule with friends, spot overlapping trips, and make the ride happen.</p>
      <div className="feature-row"><span><CalendarDays/>Plan together</span><span><MapPin/>Meet nearby</span><span><Users/>Friends only</span></div>

      <div className="auth-panel">
        <div className="auth-switch" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'SIGN_IN'} className={mode === 'SIGN_IN' ? 'active' : ''} onClick={() => { setMode('SIGN_IN'); setError(null) }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'REGISTER'} className={mode === 'REGISTER' ? 'active' : ''} onClick={() => { setMode('REGISTER'); setError(null) }}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'REGISTER' && <label>Your name<input name="name" autoComplete="name" maxLength={80} required placeholder="Alex Chen"/></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'REGISTER' ? 'new-password' : 'current-password'} minLength={10} maxLength={128} required placeholder="At least 10 characters"/></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button primary large auth-submit" disabled={pending}>{pending ? 'One moment…' : mode === 'REGISTER' ? 'Create account' : 'Sign in'} <ArrowRight/></button>
        </form>
        {googleClientId && <><div className="auth-divider"><span>or</span></div><div className="google-button" ref={googleRef}/></>}
      </div>

      {demoEnabled && <div className="demo-section"><small>Local demo</small><div className="demo-actions"><button className="button secondary" onClick={() => loginDemo('user-jimmy')}>Jimmy</button><button className="button secondary" onClick={() => loginDemo('user-daniel')}>Daniel</button></div></div>}
      <p className="privacy-note">Your schedule is shared only with accepted friends. Exact pickup details stay between confirmed riders.</p>
    </section>
    <div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/>
  </main>
}

declare global { interface Window { google?: { accounts: { id: { initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void; renderButton(element: HTMLElement, options: Record<string, string | number>): void } } } } }
