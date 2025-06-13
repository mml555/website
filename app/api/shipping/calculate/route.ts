import { NextResponse } from 'next/server'
import { calculateShippingOptions } from '@/lib/shipping'
import { z } from 'zod'
import { logError } from '@/lib/errors'

const shippingSchema = z.object({
  country: z.string().min(1, 'Country is required'),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  total: z.number().min(0, 'Total must be a positive number'),
  weight: z.number().optional(),
  // csrfToken: z.string().optional(), // Uncomment when CSRF middleware is added
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('Received shipping calculation request:', body);

    const parsed = shippingSchema.safeParse(body)
    if (!parsed.success) {
      console.error('Invalid shipping input:', parsed.error.flatten());
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: parsed.error.flatten() 
      }, { status: 400 })
    }
    // Placeholder for CSRF token validation
    // if (!validateCsrfToken(parsed.data.csrfToken)) {
    //   return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    // }
    const { country, state, zipCode, total, weight } = parsed.data
    console.log('Processing shipping calculation for:', {
      country,
      state,
      zipCode,
      total,
      weight
    });

    try {
      const options = calculateShippingOptions({ 
        country, 
        state, 
        zipCode, 
        total, 
        weight: weight || 1 // Default to 1 if weight is not provided
      })
      console.log('Calculated shipping options:', options);
      return NextResponse.json({ options })
    } catch (calcError) {
      console.error('Error calculating shipping options:', calcError);
      return NextResponse.json({ 
        error: calcError instanceof Error ? calcError.message : 'Failed to calculate shipping options'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Unexpected error in shipping calculation:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 })
  }
} 