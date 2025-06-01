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

export function logError(error: unknown, context?: string) {
  const appError = handleError(error)
  
  if (env.NODE_ENV === 'development') {
    console.error(`[${appError.code}] ${context || ''}:`, {
      message: appError.message,
      statusCode: appError.statusCode,
      details: appError.details,
      stack: appError.stack,
    })
  } else {
    // In production, log to your error tracking service
    // Example: Sentry.captureException(appError)
    console.error(`[${appError.code}] ${context || ''}: ${appError.message}`)
  }
  
  return appError
} 