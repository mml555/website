import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { calculateShippingOptions, type ShippingOption } from '@/lib/shipping';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limiter';

// Input validation schema
const shippingRequestSchema = z.object({
  country: z.string().min(2, 'Country code is required'),
  state: z.string().optional(),
  zipCode: z.string()
    .regex(/^\d{4,10}$/, 'ZIP code must be 4-10 digits')
    .optional(),
  total: z.number()
    .min(0, 'Total must be a positive number')
    .max(1000000, 'Total amount too large'),
  weight: z.number()
    .min(0, 'Weight must be a positive number')
    .max(1000, 'Weight too large')
    .optional()
    .default(1),
  shippingMethodOverride: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // Check content type
    if (request.headers.get('content-type') !== 'application/json') {
      return NextResponse.json(
        { message: 'Unsupported content type' },
        { status: 415 }
      );
    }

    // Rate limiting
    const isAllowed = await rateLimit(request, 10, 60);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Shipping calculation request:', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
        body: {
          ...body,
          total: body.total?.toFixed(2) // Sanitize for logging
        }
      });
    }

    // Validate input
    const parsed = shippingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        message: 'Invalid input',
        validationErrors: parsed.error.flatten()
      }, { status: 400 });
    }

    // CSRF protection (commented until middleware is implemented)
    // const csrfToken = request.headers.get('x-csrf-token');
    // if (!validateCsrfToken(csrfToken)) {
    //   return NextResponse.json(
    //     { message: 'Invalid CSRF token' },
    //     { status: 403 }
    //   );
    // }

    // Calculate shipping options
    const options = calculateShippingOptions({
      country: parsed.data.country,
      state: parsed.data.state,
      zipCode: parsed.data.zipCode,
      total: parsed.data.total,
      weight: parsed.data.weight
    });

    // If shipping method override is provided, recalculate with that method
    if (parsed.data.shippingMethodOverride) {
      const overrideOption = options.find(
        opt => opt.name === parsed.data.shippingMethodOverride
      );
      if (overrideOption) {
        return NextResponse.json({
          message: 'Shipping options calculated successfully',
          options: [overrideOption]
        });
      }
    }

    // Log successful calculation
    logger.info('Shipping calculation successful:', {
      country: parsed.data.country,
      total: parsed.data.total.toFixed(2),
      optionsCount: options.length
    });

    return NextResponse.json({
      message: 'Shipping options calculated successfully',
      options
    });
  } catch (error) {
    // Log error
    logger.error('Shipping calculation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return appropriate error response
    if (error instanceof Error) {
      return NextResponse.json({
        message: 'Failed to calculate shipping options',
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Internal server error'
    }, { status: 500 });
  }
} 