export function getSecurityHeaders() {
  if (typeof window !== 'undefined') {
    throw new Error('getSecurityHeaders() should never be called on the client');
  }
  return {
    'Content-Security-Policy': `
      default-src 'self' https://*.stripe.com;
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://*.vercel-analytics.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' data: blob: https://picsum.photos https://*.picsum.photos https://picsum.photos/seed/* https://*.stripe.com https://*.amazonaws.com https://*.unsplash.com https://*.cloudinary.com https://*.placeholder.com https://*.placehold.co https://*.placeholdit.imgix.net;
      font-src 'self' https://fonts.gstatic.com data:;
      object-src 'none';
      base-uri 'self';
      form-action 'self' https://*.stripe.com https://merchant-ui-api.stripe.com;
      frame-ancestors 'none';
      frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://checkout.stripe.com;
      connect-src 'self' https://*.stripe.com https://api.stripe.com https://va.vercel-scripts.com https://hooks.stripe.com wss://*.stripe.com https://*.vercel-scripts.com https://*.vercel-analytics.com https://merchant-ui-api.stripe.com https://elements.stripe.com;
      worker-src 'self' blob:;
      manifest-src 'self';
      media-src 'self' blob:;
      block-all-mixed-content;
      upgrade-insecure-requests;
      require-trusted-types-for 'script';
    `.replace(/\s+/g, ' ').trim(),
    'X-DNS-Prefetch-Control': 'on',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-XSS-Protection': '1; mode=block',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export function getCacheHeaders(maxAge: number = 0) {
  return {
    'Cache-Control': maxAge > 0 
      ? `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
      : 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
}

export function getResponseHeaders(options: { 
  maxAge?: number;
  contentType?: string;
  allowCors?: boolean;
} = {}) {
  const { maxAge = 0, contentType = 'application/json', allowCors = true } = options
  
  return {
    'Content-Type': contentType,
    ...getCacheHeaders(maxAge),
    ...(allowCors ? getSecurityHeaders() : {}),
  }
} 