import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError } from './api-error-handler'

export function validateRequest(schema: z.ZodSchema) {
  return async function (req: NextRequest) {
    try {
      const body = await req.json()
      const validatedData = schema.parse(body)
      return validatedData
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ApiError(
          'Validation error',
          400,
          'VALIDATION_ERROR',
          error.errors
        )
      }
      throw error
    }
  }
}

export function validateQuery(schema: z.ZodSchema) {
  return function (req: NextRequest) {
    try {
      const query = Object.fromEntries(req.nextUrl.searchParams)
      const validatedData = schema.parse(query)
      return validatedData
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ApiError(
          'Invalid query parameters',
          400,
          'VALIDATION_ERROR',
          error.errors
        )
      }
      throw error
    }
  }
}

export function validateParams(schema: z.ZodSchema) {
  return function (req: NextRequest) {
    try {
      const params = req.nextUrl.pathname.split('/').pop()
      const validatedData = schema.parse(params)
      return validatedData
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ApiError(
          'Invalid URL parameters',
          400,
          'VALIDATION_ERROR',
          error.errors
        )
      }
      throw error
    }
  }
} 