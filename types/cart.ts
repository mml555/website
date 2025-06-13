// Base cart item interface with common properties
export interface BaseCartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
  stock?: number;
  stockAtAdd?: number;
  type?: 'add' | 'remove' | 'update' | 'clear';
}

// Extended cart item interface for products with variants
export interface ProductCartItem extends BaseCartItem {
  variantId?: string;
  originalPrice: number;
  product?: {
    id: string;
    name: string;
    price: number;
    images: string[];
    stock: number;
  };
  variant?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

// Union type for all possible cart items
export type CartItem = BaseCartItem | ProductCartItem;

// Type guard functions
export const isProductCartItem = (item: CartItem): item is ProductCartItem => {
  return 'originalPrice' in item && 'variantId' in item && typeof (item as ProductCartItem).variantId === 'string';
};

export const isBaseCartItem = (item: CartItem): item is BaseCartItem => {
  return !isProductCartItem(item);
};

// Helper function to safely get variantId
export const getVariantId = (item: CartItem): string | undefined => {
  if (isProductCartItem(item)) {
    return item.variantId;
  }
  return undefined;
};

// Cart context type
export interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItemInput, quantity?: number) => Promise<void>;
  removeItem: (id: string, variantId?: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number, variantId?: string) => Promise<void>;
  clearCart: () => void;
  total: number;
  itemCount: number;
  error: string | null;
  clearError: () => void;
  isLoading: boolean;
  retrySync: () => Promise<void>;
  pendingChanges: CartItem[];
  cartExpiryWarning: string | null;
  // Cart sharing methods
  generateShareableCartLink: () => Promise<string | null>;
  loadSharedCart: (shareId: string) => Promise<boolean>;
  // Save for later
  savedForLater: CartItem[];
  moveToSaveForLater: (id: string, variantId?: string) => void;
  moveToCartFromSaveForLater: (id: string, variantId?: string) => void;
}

// Input type for adding items to cart
export interface CartItemInput {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  stock?: number;
}

// Cart state type for persistence
export interface CartState {
  items: CartItem[];
  lastSynced: string;
  version: string;
  pendingChanges?: CartItem[];
} 