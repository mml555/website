import { NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateShippingOptions } from '@/lib/shipping'
import { logger } from '@/lib/logger'
import type { ShippingAddress } from '@/types/address'

// Define request schema
const shippingRequestSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    weight: z.number().positive().optional(),
    dimensions: z.object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive()
    }).optional()
  })),
  address: z.object({
    country: z.string(),
    state: z.string(),
    postalCode: z.string(),
    city: z.string()
  })
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate request body
    const result = shippingRequestSchema.safeParse(body)
    if (!result.success) {
      logger.warn(result.error)
      return NextResponse.json(
        { error: 'Invalid request data', details: result.error.format() },
        { status: 400 }
      )
    }

    const { items, address } = result.data

    // Calculate total and weight
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const weight = items.reduce((sum, item) => sum + ((item.weight || 1) * item.quantity), 0)

    // Calculate shipping options
    const shippingOptions = calculateShippingOptions({
      address: address as ShippingAddress,
      total,
      weight
    })

    return NextResponse.json({ shippingOptions })
  } catch (error) {
    logger.error(error)
    return NextResponse.json(
      { error: 'Failed to calculate shipping rates' },
      { status: 500 }
    )
  }
} 