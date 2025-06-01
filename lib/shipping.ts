export type ShippingOption = {
  name: string;
  rate: number;
  estimatedDays: number;
};

export type ShippingInput = {
  country: string;
  state?: string;
  zipCode?: string;
  total: number;
  weight?: number;
};

const SHIPPING_RATES = [
  {
    name: 'Standard Shipping',
    rate: 5.99,
    minOrder: 0,
    maxOrder: 50,
    estimatedDays: 5,
  },
  {
    name: 'Express Shipping',
    rate: 12.99,
    minOrder: 0,
    maxOrder: 100,
    estimatedDays: 2,
  },
  {
    name: 'Free Shipping',
    rate: 0,
    minOrder: 50,
    maxOrder: Infinity,
    estimatedDays: 7,
  },
];

export function calculateShippingOptions(input: ShippingInput): ShippingOption[] {
  // Example: free shipping for US orders over $50
  if (input.country === 'US' || input.country === 'United States') {
    if (input.total >= 50) {
      // Only return Free Shipping if eligible, with only the expected fields
      const free = SHIPPING_RATES.find(option => option.name === 'Free Shipping')!
      return [{ name: free.name, rate: free.rate, estimatedDays: free.estimatedDays }]
    }
    return SHIPPING_RATES.filter(option => input.total >= option.minOrder && input.total < option.maxOrder && option.name !== 'Free Shipping')
      .map(({ name, rate, estimatedDays }) => ({ name, rate, estimatedDays }));
  }
  // International: flat rate + express
  return [
    { name: 'International Standard', rate: 19.99, estimatedDays: 10 },
    { name: 'International Express', rate: 39.99, estimatedDays: 4 },
  ];
} 