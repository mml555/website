import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { AppError } from './app-errors'

export function decimalToNumber(value: any): number {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

export function formatStock(stock: number): string {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= 5) return `Only ${stock} left in stock`;
  return `${stock} in stock`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function validateProductData(data: any): { isValid: boolean; error?: string } {
  if (!data) return { isValid: false, error: 'No data provided' }
  if (!data.id) return { isValid: false, error: 'Product ID is required' }
  if (!data.name) return { isValid: false, error: 'Product name is required' }
  if (typeof data.price !== 'number' || isNaN(data.price) || data.price < 0) {
    return { isValid: false, error: 'Invalid price' }
  }
  if (!Array.isArray(data.images)) {
    return { isValid: false, error: 'Product images must be an array' }
  }
  if (data.images.length === 0 && !data.image) {
    return { isValid: false, error: 'Product must have at least one image' }
  }
  if (data.images.length > 0 && typeof data.images[0] !== 'string') {
    return { isValid: false, error: 'Product images must be an array of strings' }
  }
  return { isValid: true }
}

export function validateCartItem(data: any): { isValid: boolean; error?: string } {
  if (!data) return { isValid: false, error: 'No data provided' }
  if (!data.id) return { isValid: false, error: 'Item ID is required' }
  if (!data.name) return { isValid: false, error: 'Item name is required' }
  if (typeof data.price !== 'number' || isNaN(data.price) || data.price < 0) {
    return { isValid: false, error: 'Invalid price' }
  }
  if (typeof data.quantity !== 'number' || isNaN(data.quantity) || data.quantity < 1) {
    return { isValid: false, error: 'Invalid quantity' }
  }
  if (!data.image || typeof data.image !== 'string') {
    return { isValid: false, error: 'Item image is required and must be a string' }
  }
  return { isValid: true }
}

export function getDefaultImage(): string {
  return "/images/placeholder.svg"
}

export function handleApiError(error: unknown): { message: string; status?: number } {
  if (error instanceof AppError) {
    const result: { message: string; status?: number } = { message: error.message };
    if (typeof (error as any).status === 'number') {
      result.status = (error as any).status;
    }
    return result;
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: 'An unexpected error occurred' };
}

export function formatApiResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }
}

export function formatApiError(message: string, status: number) {
  return {
    success: false,
    error: {
      message,
      status,
      timestamp: new Date().toISOString()
    }
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively converts Decimal fields to numbers in an object or array.
 * Useful for Prisma models with Decimal fields (e.g., price, cost, salePrice).
 */
export function convertDecimalsToNumbers<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(convertDecimalsToNumbers) as any;
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      const value = (obj as any)[key];
      if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
        result[key] = value.toNumber();
      } else if (Array.isArray(value) || (value && typeof value === 'object')) {
        result[key] = convertDecimalsToNumbers(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

export function validatePrice(price: any): number {
  const num = Number(price)
  if (isNaN(num) || num < 0) {
    console.warn('Invalid price value:', price)
    return 0
  }
  return num
} 