import { z } from "zod"

/**
 * Environment Variables Configuration
 * 
 * This module handles environment variable validation and type safety for both
 * server-side and client-side code. It uses Zod for runtime validation and
 * TypeScript for compile-time type checking.
 * 
 * Required Variables:
 * - STRIPE_SECRET_KEY: Your Stripe secret key for server-side operations
 * - STRIPE_WEBHOOK_SECRET: Your Stripe webhook secret for event verification
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: Your Stripe publishable key for client-side operations
 * 
 * Optional Variables:
 * - NEXT_PUBLIC_API_URL: API base URL (defaults to http://localhost:3000)
 * - NEXT_PUBLIC_WS_URL: WebSocket URL (defaults to ws://localhost:3000)
 * - NEXT_PUBLIC_APP_URL: App base URL (defaults to http://localhost:3000)
 * - NEXT_PUBLIC_SITE_URL: Site base URL (defaults to http://localhost:3000)
 * 
 * Development Variables:
 * - NEXTAUTH_URL: NextAuth.js URL for authentication
 * - NEXTAUTH_SECRET: NextAuth.js secret for session encryption
 * - DATABASE_URL: Database connection string
 * - SMTP_*: Email configuration variables
 * 
 * Monitoring Variables:
 * - NEXT_PUBLIC_SENTRY_DSN: Sentry DSN for error tracking
 * - SENTRY_AUTH_TOKEN: Sentry authentication token
 * - SENTRY_ORG: Sentry organization name
 * - SENTRY_PROJECT: Sentry project name
 */

// NOTE: Do NOT import from this file in client components. For client-safe env vars, use `lib/client-env.ts`.
// Only server code should import from here.

// Enhanced error handling for environment variables
class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvError'
  }
}

// Hard guard: Never access process.env directly on the client
const isClient = typeof window !== 'undefined';

export const nodeEnv = process.env.NODE_ENV || 'test';

if (isClient) {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    // Remove process.env from globalThis to prevent accidental access
    // @ts-ignore
    delete process.env;
  }
}

// Helper function to assert environment variables
function assertEnvVar(key: keyof typeof process.env): string {
  const val = process.env[key]
  if (!val) {
    throw new EnvError(
      `Required environment variable ${key} is missing. Please check your .env file and environment configuration.`
    )
  }
  return val
}

// Debug logging for environment variables
if (!isClient) {
  // Add detailed logging for client environment variables
  // console.log('Client Environment Variables:', {
  //   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  //   NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  //   NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  //   NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  //   NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  // })
}

// Server-side environment variables with enhanced validation
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  
  // URLs - Optional in development
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  
  // Authentication - Optional in development
  NEXTAUTH_URL: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  
  // Database - Optional in development
  DATABASE_URL: z.string().min(1).optional(),
  
  // Redis - Optional in development
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  
  // Stripe - Required in all environments
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  
  // Email - Optional in development
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().min(1).optional(),
  SMTP_SECURE: z.string().min(1).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
  
  // Resend - Optional
  RESEND_API_KEY: z.string().min(1).optional(),
  
  // Rate limit - Optional in development
  RATE_LIMIT_MAX: z.coerce.number().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional(),
})

// Client-side environment variables - Only validate what's needed on the client
const clientSchema = z.object({
  // Required in all environments
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  
  // Optional in development, required in production
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
})

// List of required environment variables
const requiredServerVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const

// Filter environment variables for client-side
const getClientEnv = () => {
  const envObj: Record<string, any> = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const clientEnv: Record<string, string | undefined> = {};
  Object.keys(envObj).forEach(key => {
    if (key.startsWith('NEXT_PUBLIC_')) {
      clientEnv[key] = envObj[key];
    }
  });
  return clientEnv;
}

// Parse and validate environment variables
const _env = serverSchema.safeParse(process.env)
const _clientEnv = clientSchema.safeParse(isClient ? getClientEnv() : process.env)

// Enhanced error handling for environment variables
if (!_env.success && !isClient) {
  const missingVars = Object.keys(serverSchema.shape).filter(
    key => !process.env[key]
  )
  
  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file and environment configuration.`
    // console.error(errorMessage)
    
    // Only throw error in production
    if (process.env.NODE_ENV === 'production') {
      throw new EnvError(errorMessage)
    }
  }
}

if (!_clientEnv.success && isClient) {
  const clientVars = getClientEnv();
  const missingVars = Object.keys(clientSchema.shape).filter(
    key => !clientVars[key]
  );
  if (missingVars.length > 0) {
    const isProduction = nodeEnv === 'production'
    const message = isProduction
      ? `Missing required client environment variables: ${missingVars.join(', ')}. Please check your environment configuration.`
      : `Missing client environment variables in development: ${missingVars.join(', ')}. These are only required in production.\nThis warning is informational and does not block app startup.`
    if (isProduction) {
      // console.error(message)
      throw new EnvError(message)
    } else {
      // Only warn if something is actually missing
      // console.warn(message) // Suppressed in development
    }
  }
}

// Always return all client env keys, fallback to empty string if missing
export const env = (() => {
  if (isClient) {
    throw new Error("Do not use `env` on the client. Use `clientEnv` instead.");
  }
  return _env.success ? _env.data : {} as z.infer<typeof serverSchema>;
})();
export const clientEnv = _clientEnv.success ? _clientEnv.data : {} as z.infer<typeof clientSchema>

// Type declarations
declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof serverSchema> {}
  }
}

// Helper function to check if all required environment variables are present
export function validateEnv() {
  // Skip validation on client side
  if (isClient) return true

  const missingVars = requiredServerVars.filter(key => !process.env[key])
  
  if (missingVars.length > 0) {
    // console.error(
    //   `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file and environment configuration.`
    // )
    return false
  }

  return true
}

// Initialize environment validation only on server side
if (!isClient) {
  validateEnv()
}

if (process.env.NODE_ENV === 'development' && typeof global !== 'undefined') {
  const origStringify = JSON.stringify;
  // @ts-ignore
  JSON.stringify = function (value: any, replacer: any, space: any) {
    function hasEnv(obj: any, seen = new Set()) {
      if (!obj || typeof obj !== 'object' || seen.has(obj)) return false;
      seen.add(obj);
      if ('env' in obj) return true;
      for (const key in obj) {
        if (hasEnv(obj[key], seen)) return true;
      }
      return false;
    }
    if (hasEnv(value)) {
      // eslint-disable-next-line no-console
      // console.error('[DEV] Serializing object with nested .env property:', value);
      // eslint-disable-next-line no-console
      // console.trace('[DEV] Serialization stack trace');
    }
    return origStringify.call(this, value, replacer, space);
  };
}

const isProduction = nodeEnv === 'production'

if (nodeEnv === 'development' && typeof global !== 'undefined') {
  // ... existing code ...
}