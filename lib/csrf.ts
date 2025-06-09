import { randomBytes, createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { nodeEnv } from './env'

const CSRF_SECRET = process.env.CSRF_SECRET || 'default_csrf_secret'
const CSRF_COOKIE = 'csrf_token'

export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('hex')
  const hmac = createHmac('sha256', CSRF_SECRET).update(token).digest('hex')
  return `${token}:${hmac}`
}

export function setCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })
}

export function validateCsrfToken(token: string | undefined | null): boolean {
  if (!token) return false
  const [raw, hmac] = token.split(':')
  if (!raw || !hmac) return false
  const expected = createHmac('sha256', CSRF_SECRET).update(raw).digest('hex')
  return hmac === expected
}

export function getCsrfTokenFromRequest(req: NextRequest): string | undefined {
  // Try header first
  const headerToken = req.headers.get('x-csrf-token')
  if (headerToken) return headerToken
  // Try cookie
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value
  if (cookieToken) return cookieToken
  return undefined
} 