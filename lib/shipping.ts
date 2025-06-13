import { ShippingAddress } from '@/types/address';
import { shippingAddressSchema } from '@/types/address';

export type ShippingOption = {
  id: string;
  name: string;
  rate: number;
  estimatedDays: number;
  description?: string;
  minOrder?: number;
  maxOrder?: number;
  minWeight?: number;
  maxWeight?: number;
  availableCountries?: string[];
};

export type ShippingInput = {
  address: ShippingAddress;
  total: number;
  weight?: number;
};

// Shipping rates configuration
const SHIPPING_RATES: ShippingOption[] = [
  {
    id: 'standard',
    name: 'Standard Shipping',
    rate: 5.99,
    minOrder: 0,
    maxOrder: 50,
    estimatedDays: 5,
    description: 'Standard ground shipping within 5-7 business days',
    availableCountries: ['US', 'USA', 'United States']
  },
  {
    id: 'express',
    name: 'Express Shipping',
    rate: 12.99,
    minOrder: 0,
    maxOrder: 100,
    estimatedDays: 2,
    description: 'Express shipping within 2-3 business days',
    availableCountries: ['US', 'USA', 'United States']
  },
  {
    id: 'free',
    name: 'Free Shipping',
    rate: 0,
    minOrder: 50,
    maxOrder: Infinity,
    estimatedDays: 7,
    description: 'Free standard shipping on orders over $50',
    availableCountries: ['US', 'USA', 'United States']
  },
  {
    id: 'international-standard',
    name: 'International Standard',
    rate: 19.99,
    minOrder: 0,
    maxOrder: Infinity,
    estimatedDays: 10,
    description: 'International standard shipping within 10-14 business days',
    availableCountries: ['*'] // Available for all countries
  },
  {
    id: 'international-express',
    name: 'International Express',
    rate: 39.99,
    minOrder: 0,
    maxOrder: Infinity,
    estimatedDays: 4,
    description: 'International express shipping within 4-6 business days',
    availableCountries: ['*'] // Available for all countries
  }
];

/**
 * Type guard to check if an object is a valid ShippingOption
 */
export function isValidShippingOption(option: any): option is ShippingOption {
  return (
    option &&
    typeof option.id === 'string' && option.id.trim() !== '' &&
    typeof option.name === 'string' && option.name.trim() !== '' &&
    typeof option.rate === 'number' && !isNaN(option.rate) && option.rate >= 0 &&
    typeof option.estimatedDays === 'number' && !isNaN(option.estimatedDays) && option.estimatedDays > 0
  );
}

/**
 * Validates shipping input and returns any validation errors
 */
export function validateShippingInput(input: ShippingInput): string | null {
  if (!input.address) {
    return 'Shipping address is required';
  }

  try {
    shippingAddressSchema.parse(input.address);
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Invalid shipping address';
  }

  if (typeof input.total !== 'number' || isNaN(input.total) || input.total < 0) {
    return 'Total must be a positive number';
  }

  if (input.weight !== undefined && (typeof input.weight !== 'number' || isNaN(input.weight) || input.weight < 0)) {
    return 'Weight must be a positive number';
  }

  return null;
}

/**
 * Checks if a shipping option is available for the given input
 */
function isShippingOptionAvailable(option: ShippingOption, input: ShippingInput): boolean {
  // Check country availability
  if (option.availableCountries) {
    if (!option.availableCountries.includes('*') && 
        !option.availableCountries.includes(input.address.country)) {
      return false;
    }
  }

  // Check order total limits
  if (option.minOrder !== undefined && input.total < option.minOrder) {
    return false;
  }
  if (option.maxOrder !== undefined && input.total >= option.maxOrder) {
    return false;
  }

  // Check weight limits if applicable
  if (input.weight !== undefined) {
    if (option.minWeight !== undefined && input.weight < option.minWeight) {
      return false;
    }
    if (option.maxWeight !== undefined && input.weight >= option.maxWeight) {
      return false;
    }
  }

  return true;
}

export function calculateShippingOptions(input: ShippingInput): ShippingOption[] {
  // Validate input first
  const validationError = validateShippingInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  // Normalize country code
  const country = input.address.country === 'USA' ? 'US' : input.address.country;

  // Ensure total is a valid number
  const total = typeof input.total === 'number' && !isNaN(input.total) ? input.total : 0;

  // Filter available shipping options
  const availableOptions = SHIPPING_RATES.filter(option => {
    try {
      return isShippingOptionAvailable(option, { 
        ...input, 
        total,
        address: { 
          ...input.address, 
          country,
          state: input.address.state || '',
          postalCode: input.address.postalCode || '',
          type: input.address.type || 'SHIPPING'
        } 
      });
    } catch (err) {
      console.error('Error checking shipping option availability:', err);
      return false;
    }
  });

  if (availableOptions.length === 0) {
    // If no options match the criteria, return a default option
    return [{
      id: 'standard',
      name: 'Standard Shipping',
      rate: 5.99,
      estimatedDays: 5,
      description: 'Standard ground shipping',
      availableCountries: ['*']
    }];
  }

  console.log('Available shipping options:', availableOptions);
  return availableOptions;
} 