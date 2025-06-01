import { calculateShippingOptions } from '@/lib/shipping'

describe('calculateShippingOptions', () => {
  it('returns standard and express for US orders under $50', () => {
    const options = calculateShippingOptions({ country: 'US', total: 30 })
    expect(options).toEqual([
      { name: 'Standard Shipping', rate: 5.99, estimatedDays: 5 },
      { name: 'Express Shipping', rate: 12.99, estimatedDays: 2 },
    ])
  })

  it('returns free shipping for US orders $50 and above', () => {
    const options = calculateShippingOptions({ country: 'US', total: 60 })
    expect(options).toEqual([
      { name: 'Free Shipping', rate: 0, estimatedDays: 7 },
    ])
  })

  it('returns international options for non-US', () => {
    const options = calculateShippingOptions({ country: 'CA', total: 100 })
    expect(options).toEqual([
      { name: 'International Standard', rate: 19.99, estimatedDays: 10 },
      { name: 'International Express', rate: 39.99, estimatedDays: 4 },
    ])
  })
}) 