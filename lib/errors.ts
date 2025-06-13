// NOTE: Do NOT import this file in client components. It uses env from lib/env.ts, which is server-only.
import { AppError } from './app-errors'
import { env } from './env'

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message)
  }

  return new AppError('An unexpected error occurred')
}

type LogContext = string | Record<string, unknown> | null | undefined
type LogError = unknown | null | undefined

export function logError(error: LogError, context?: LogContext) {
  const appError = handleError(error)
  const contextStr = typeof context === 'string' ? context : JSON.stringify(context || {})
  
  if (env.NODE_ENV === 'development') {
    console.error(`[${appError.code}] ${contextStr}:`, {
      message: appError.message,
      statusCode: appError.statusCode,
      details: appError.details,
      stack: appError.stack,
    })
  } else {
    // In production, log to your error tracking service
    // Example: Sentry.captureException(appError)
  }
  
  return appError
} 