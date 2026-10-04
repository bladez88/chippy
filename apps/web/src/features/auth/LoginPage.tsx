import { useEffect, useRef } from 'react'
import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { login, loginGoogle } = useAuth(); const googleRef = useRef<HTMLDivElement>(null); const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  useEffect(() => {
    if (!googleClientId) return
    const render = () => { window.google?.accounts.id.initialize({ client_id: googleClientId, callback: ({ credential }) => void loginGoogle(credential) }); if (googleRef.current) window.google?.accounts.id.renderButton(googleRef.current, { theme: 'outline', size: 'large', shape: 'pill', width: 360 }) }
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]')
    if (existing) { render(); return }
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.dataset.googleIdentity = 'true'; script.onload = render; document.head.appendChild(script)
  }, [googleClientId, loginGoogle])
  return <main className="login-page">
    <div className="brand"><span className="brand-mark">c</span><span>chippy</span></div>
    <section className="login-card">
      <div className="eyebrow">Carpools, minus the group chat chaos</div>
      <h1>Going the same way?</h1>
      <p className="lead">Share your schedule with friends, spot overlapping trips, and make the ride happen.</p>
      <div className="feature-row"><span><CalendarDays/>Plan together</span><span><MapPin/>Meet nearby</span><span><Users/>Friends only</span></div>
      <div className="demo-actions"><button className="button primary large" onClick={() => login('user-jimmy')}>Demo as Jimmy <ArrowRight/></button><button className="button secondary large" onClick={() => login('user-daniel')}>Demo as Daniel <ArrowRight/></button></div>
      {googleClientId ? <div className="google-button" ref={googleRef}/> : <button className="button google" disabled>Continue with Google <small>Configure client ID</small></button>}
      <p className="privacy-note">Use Jimmy to request a ride, then Daniel to accept it. Exact pickup details stay between confirmed riders.</p>
    </section>
    <div className="login-orbit orbit-one"/><div className="login-orbit orbit-two"/>
  </main>
}

declare global { interface Window { google?: { accounts: { id: { initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void; renderButton(element: HTMLElement, options: Record<string, string | number>): void } } } } }
