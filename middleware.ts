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
      const callbackUrl = encodeURIComponent(request.nextUrl.pathname)
      return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url))
    }

    // Check for admin role
    if (token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Check authentication for API routes
  if (request.nextUrl.pathname.startsWith('/api/dashboard')) {
    const token = await getToken({ req: request })
    
    if (!token) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          message: 'Please sign in to access this resource'
        },
        { status: 401 }
      )
    }
    
    if (token.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          error: 'Admin access required',
          code: 'ADMIN_REQUIRED',
          message: 'You do not have permission to access this resource'
        },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
} 