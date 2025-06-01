import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { rateLimitMiddleware } from '@/lib/rate-limiter'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/:path*',
  ],
}

export async function middleware(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  // Check authentication for protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const token = await getToken({ req: request })
    
    if (!token) {
      return NextResponse.redirect(new URL('/login?callbackUrl=/dashboard', request.url))
    }

    // Check for admin role
    if (token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Check authentication for API routes
  if (request.nextUrl.pathname.startsWith('/api/dashboard')) {
    const token = await getToken({ req: request })
    
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
} 