export interface ProductVariant {
  id: string
  name: string
  type: string
  price: number
  stock: number
  image?: string | null
  specs?: Record<string, any>
  sku?: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  images: string[]
  categoryId: string | null
  category: {
    id: string
    name: string
  } | null
  weight: number | null
  sku: string | null
  featured: boolean
  isActive: boolean
  variants?: ProductVariant[]
  tags?: string[]
  rating?: number
  reviews?: number
  brand?: string | null
  dimensions?: {
    length: number
    width: number
    height: number
  } | null
  shipping?: {
    weight: number
    dimensions: {
      length: number
      width: number
      height: number
    }
    freeShipping: boolean
  } | null
  metadata?: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

// Type for cart items
export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock?: number;
  stockAtAdd?: number;
  metadata?: Record<string, any>;
}

// Type for database cart items
export interface DbCartItem {
  id: string
  cartId: string
  productId: string
  variantId?: string | null
  quantity: number
  createdAt: Date
  updatedAt: Date
  product: {
    id: string
    name: string
    price: number
    images: string[]
    stock: number
    sku: string | null
  }
  variant?: {
    id: string
    name: string
    price: number | null
    stock: number
    image: string | null
  } | null
} 