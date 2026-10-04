import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env.js'

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID)
export async function verifyGoogleCredential(credential: string) {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('Google authentication is not configured')
  const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID })
  const payload = ticket.getPayload()
  if (!payload?.email || !payload.email_verified || !payload.sub) throw new Error('Google account email is not verified')
  return { subject: payload.sub, email: payload.email, name: payload.name ?? payload.email, avatarUrl: payload.picture ?? null }
}
