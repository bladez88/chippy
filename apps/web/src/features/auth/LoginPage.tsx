import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { login, loginGoogle, loginWithPassword, register } = useAuth()
  const googleRef = useRef<HTMLDivElement>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (!googleClientId) return
    const render = () => { window.google?.accounts.id.initialize({ client_id: googleClientId, callback: ({ credential }) => void loginGoogle(credential) }); if (googleRef.current) window.google?.accounts.id.renderButton(googleRef.current, { theme: 'outline', size: 'large', shape: 'pill', width: 360 }) }
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
    if (existing) { render(); return }
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.dataset.googleIdentity = 'true'; script.onload = render; document.head.appendChild(script)
  }, [googleClientId, loginGoogle])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'register') await register({ email, name, password })
      else await loginWithPassword({ email, password })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  return <main className="login-page">
    <div className="brand"><span className="brand-mark">c</span><span>chippy</span></div>
    <section className="login-card">
      <div className="eyebrow">Carpools, minus the group chat chaos</div>
      <h1>Going the same way?</h1>
      <p className="lead">Share your schedule with friends, spot overlapping trips, and make the ride happen.</p>
      <div className="feature-row"><span><CalendarDays/>Plan together</span><span><MapPin/>Meet nearby</span><span><Users/>Friends only</span></div>
      <div className="account-panel">
        <h2>{mode === 'register' ? 'Create your account' : 'Sign in to Chippy'}</h2>
        <form className="account-form" onSubmit={submit}>
          {mode === 'register' && <label>Name<input autoComplete="name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : undefined} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button primary large" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'} <ArrowRight/>
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'register' ? 'Already have an account?' : 'New to Chippy?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>
            {mode === 'register' ? 'Sign in' : 'Create account'}
          </button>
        </p>
        {googleClientId && <><div className="auth-divider"><span>or</span></div><div className="google-button" ref={googleRef}/></>}
      </div>
      <div className="demo-actions"><button className="button secondary large" onClick={() => login('user-jimmy')}>Demo as Jimmy <ArrowRight/></button><button className="button secondary large" onClick={() => login('user-daniel')}>Demo as Daniel <ArrowRight/></button></div>
      <p className="privacy-note">Use Jimmy to request a ride, then Daniel to accept it. Exact pickup details stay between confirmed riders.</p>
    </section>
    <div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/>
  </main>
}

declare global { interface Window { google?: { accounts: { id: { initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void; renderButton(element: HTMLElement, options: Record<string, string | number>): void } } } } }
