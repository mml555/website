import { z } from 'zod'

// Phone number validation regex - allows international formats
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

// Enhanced email validation
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// US ZIP code validation
const usZipRegex = /^\d{5}(-\d{4})?$/;

// Canadian postal code validation
const caPostalRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

// UK postcode validation
const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

export const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  categoryId: z.string().min(1, 'Category is required'),
  images: z.array(z.string().url('Invalid image URL')).min(1, 'At least one image is required'),
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().min(1, 'Description is required'),
})

export const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string()
    .min(1, 'Email is required')
    .regex(emailRegex, 'Please enter a valid email address')
    .max(254, 'Email address is too long'),
  phone: z.string()
    .min(1, 'Phone number is required')
    .regex(phoneRegex, 'Please enter a valid phone number'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string()
    .min(1, 'Postal code is required')
    .refine((val) => {
      // Validate based on country
      if (val.length === 0) return false;
      
      // US ZIP code
      if (usZipRegex.test(val)) return true;
      
      // Canadian postal code
      if (caPostalRegex.test(val)) return true;
      
      // UK postcode
      if (ukPostcodeRegex.test(val)) return true;
      
      // For other countries, just ensure it's not empty
      return val.length >= 3;
    }, 'Please enter a valid postal code'),
  country: z.string().min(1, 'Country is required')
});

export const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive()
  })),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  total: z.number().positive(),
  shippingRate: z.number().optional()
});

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['USER', 'ADMIN']),
})

export const userAddressSchema = z.object({
  label: z.string().optional(),
  type: z.enum(['SHIPPING', 'BILLING']),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required').or(z.literal('')).optional(),
  phone: z.string().optional(),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
})

export type ProductInput = z.infer<typeof productSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type OrderInput = z.infer<typeof orderSchema>
export type UserInput = z.infer<typeof userSchema>

// --- Admin Product Schemas ---
export const adminProductCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  isActive: z.boolean().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  image: z.string().url('Invalid image URL').optional(),
  cost: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
});

export const adminProductUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  price: z.number().positive('Price must be positive').optional(),
  stock: z.number().int().min(0, 'Stock cannot be negative').optional(),
  isActive: z.boolean().optional(),
});

export const importFileSchema = z.object({
  file: z.instanceof(File),
});

export type AdminProductCreateInput = z.infer<typeof adminProductCreateSchema>;
export type AdminProductUpdateInput = z.infer<typeof adminProductUpdateSchema>; 