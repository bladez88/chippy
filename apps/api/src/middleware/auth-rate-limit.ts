import type { NextFunction, Request, Response } from 'express'

const WINDOW_MS = 15 * 60_000
const MAX_ATTEMPTS = 10
const MAX_TRACKED_KEYS = 10_000
const attempts = new Map<string, { count: number; resetsAt: number }>()

export function authRateLimit(request: Request, response: Response, next: NextFunction) {
  const now = Date.now()
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : 'unknown'
  const key = `${request.ip}:${email}`
  const current = attempts.get(key)
  const entry = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + WINDOW_MS } : current
  entry.count += 1
  attempts.set(key, entry)
  if (attempts.size > MAX_TRACKED_KEYS) {
    for (const [trackedKey, tracked] of attempts) {
      if (tracked.resetsAt <= now || attempts.size > MAX_TRACKED_KEYS) attempts.delete(trackedKey)
      if (attempts.size <= MAX_TRACKED_KEYS) break
    }
  }
  if (entry.count > MAX_ATTEMPTS) {
    response.setHeader('Retry-After', Math.max(1, Math.ceil((entry.resetsAt - now) / 1000)))
    return response.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.', requestId: response.locals.requestId } })
  }
  next()
}
