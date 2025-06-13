import { z } from 'zod';

// Base address schema
export const baseAddressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

// Shipping address schema
export const shippingAddressSchema = baseAddressSchema.extend({
  type: z.literal('SHIPPING')
});

// Billing address schema
export const billingAddressSchema = baseAddressSchema.extend({
  type: z.literal('BILLING'),
  sameAsShipping: z.boolean().optional()
});

// Base address type
export type BaseAddress = z.infer<typeof baseAddressSchema>;

// Shipping address type
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

// Billing address type
export type BillingAddress = z.infer<typeof billingAddressSchema>;

// Address validation functions using Zod
export function validateShippingAddress(address: Partial<ShippingAddress>): string | null {
  try {
    shippingAddressSchema.parse(address);
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors[0].message;
    }
    return 'Invalid address format';
  }
}

export function validateBillingAddress(address: Partial<BillingAddress>): string | null {
  try {
    billingAddressSchema.parse(address);
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors[0].message;
    }
    return 'Invalid address format';
  }
}

// Address type guard functions
export function isShippingAddress(address: any): address is ShippingAddress {
  return shippingAddressSchema.safeParse(address).success;
}

export function isBillingAddress(address: any): address is BillingAddress {
  return billingAddressSchema.safeParse(address).success;
} 