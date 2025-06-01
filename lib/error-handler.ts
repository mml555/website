import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof ZodError) {
    return new AppError(
      'Validation error',
      400,
      'VALIDATION_ERROR'
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new AppError(
          'A record with this value already exists',
          409,
          'UNIQUE_CONSTRAINT_VIOLATION'
        )
      case 'P2025':
        return new AppError(
          'Record not found',
          404,
          'NOT_FOUND'
        )
      default:
        return new AppError(
          'Database error',
          500,
          'DATABASE_ERROR'
        )
    }
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      500,
      'INTERNAL_SERVER_ERROR'
    )
  }

  return new AppError(
    'An unexpected error occurred',
    500,
    'INTERNAL_SERVER_ERROR'
  )
}

export function formatErrorResponse(error: AppError) {
  return {
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    },
  }
} 