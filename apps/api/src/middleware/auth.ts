import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export const SESSION_COOKIE = 'chippy_session'
export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies?.[SESSION_COOKIE]
  if (!token) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue', requestId: response.locals.requestId } })
  try { request.userId = (jwt.verify(token, env.JWT_SECRET) as { sub: string }).sub; next() }
  catch { response.clearCookie(SESSION_COOKIE); return response.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Your session expired', requestId: response.locals.requestId } }) }
}
export function issueSession(response: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d', issuer: 'chippy' })
  response.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 86400_000, path: '/' })
}
