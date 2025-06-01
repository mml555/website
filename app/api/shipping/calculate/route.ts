import { NextResponse } from 'next/server'
import { calculateShippingOptions } from '@/lib/shipping'
import { z } from 'zod'

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
    const parsed = shippingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }
    // Placeholder for CSRF token validation
    // if (!validateCsrfToken(parsed.data.csrfToken)) {
    //   return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    // }
    const { country, state, zipCode, total, weight } = parsed.data
    const options = calculateShippingOptions({ country, state, zipCode, total, weight })
    return NextResponse.json({ options })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : error }, { status: 400 })
  }
} 