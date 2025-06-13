import type { CartItem, BaseCartItem, ProductCartItem } from '@/types/cart';
import { isBaseCartItem, isProductCartItem } from '@/types/cart';
import { validatePrice } from '@/lib/AppUtils';
import { logger } from '@/lib/logger';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;

export interface CartState {
  items: CartItem[];
  lastSynced: string;
  version: string;
  pendingChanges?: CartItem[];
}

export interface PendingOperation {
  type: 'add' | 'remove' | 'update' | 'sync';
  data: any;
  timestamp: number;
}

class CartOperationQueue {
  private queue: PendingOperation[] = [];
  private processing: boolean = false;

  async add(operation: Omit<PendingOperation, 'timestamp'>) {
    this.queue.push({
      ...operation,
      timestamp: Date.now()
    });
    await this.process();
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    try {
      const operation = this.queue[0];
      // Process operation here
      this.queue.shift();
    } catch {
      // Remove all console.error and console.warn statements
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        await this.process();
      }
    }
  }

  clear() {
    this.queue = [];
  }

  get length() {
    return this.queue.length;
  }
}

export const cartQueue = new CartOperationQueue();

export function generateCartItemId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export const validateCartItem = (item: unknown): CartItem | null => {
  try {
    if (!item || typeof item !== 'object') {
      logger.warn(item, 'Invalid cart item: not an object');
      return null;
    }

    const baseItem = item as BaseCartItem;
    const productItem = item as ProductCartItem;

    // Check required base properties
    if (!baseItem.id || typeof baseItem.id !== 'string') {
      logger.warn(item, 'Invalid cart item: missing or invalid id');
      return null;
    }
    if (!baseItem.productId || typeof baseItem.productId !== 'string') {
      logger.warn(item, 'Invalid cart item: missing or invalid productId');
      return null;
    }
    if (typeof baseItem.quantity !== 'number' || baseItem.quantity <= 0) {
      logger.warn(item, 'Invalid cart item: missing or invalid quantity');
      return null;
    }
    if (typeof baseItem.price !== 'number' || baseItem.price < 0) {
      logger.warn(item, 'Invalid cart item: missing or invalid price');
      return null;
    }
    if (!baseItem.name || typeof baseItem.name !== 'string') {
      logger.warn(item, 'Invalid cart item: missing or invalid name');
      return null;
    }
    if (!baseItem.image || typeof baseItem.image !== 'string') {
      logger.warn(item, 'Invalid cart item: missing or invalid image');
      return null;
    }

    // Check if it's a product cart item
    if ('originalPrice' in item && 'product' in item) {
      if (typeof productItem.originalPrice !== 'number' || productItem.originalPrice < 0) {
        logger.warn(item, 'Invalid product cart item: missing or invalid originalPrice');
        return null;
      }
      if (productItem.product && typeof productItem.product !== 'object') {
        logger.warn(item, 'Invalid product cart item: invalid product object');
        return null;
      }
      if (productItem.variant && typeof productItem.variant !== 'object') {
        logger.warn(item, 'Invalid product cart item: invalid variant object');
        return null;
      }
      return productItem;
    }

    return baseItem;
  } catch (error) {
    logger.error(error, 'Error validating cart item');
    return null;
  }
};

export const validateCartState = (state: unknown): CartState | null => {
  try {
    if (!state || typeof state !== 'object') {
      logger.warn(state, 'Invalid cart state: not an object');
      return null;
    }

    const cartState = state as CartState;

    // Validate items array
    if (!Array.isArray(cartState.items)) {
      logger.warn(state, 'Invalid cart state: items is not an array');
      return null;
    }

    // Validate each item
    const validItems = cartState.items
      .map(validateCartItem)
      .filter((item): item is CartItem => item !== null);

    if (validItems.length !== cartState.items.length) {
      logger.warn(state, 'Invalid cart state: some items failed validation');
      return null;
    }

    // Validate other required properties
    if (!cartState.lastSynced || typeof cartState.lastSynced !== 'string') {
      logger.warn(state, 'Invalid cart state: missing or invalid lastSynced');
      return null;
    }
    if (!cartState.version || typeof cartState.version !== 'string') {
      logger.warn(state, 'Invalid cart state: missing or invalid version');
      return null;
    }

    return {
      ...cartState,
      items: validItems
    };
  } catch (error) {
    logger.error(error, 'Error validating cart state');
    return null;
  }
};

export function compressCartData(items: CartItem[]): string {
  return JSON.stringify(items);
}

export function decompressCartData(data: string): CartItem[] {
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function syncWithRetry(items: CartItem[], maxRetries = 3): Promise<CartItem[]> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      
      if (!response.ok) throw new Error('Sync failed');
      
      const data = await response.json();
      return data.items;
    } catch (error) {
      retries++;
      if (retries === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  return items;
}

export async function validateStockBeforeSync(items: CartItem[]): Promise<boolean> {
  try {
    const response = await fetch('/api/cart/validate-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.valid;
  } catch {
    return false;
  }
}

export function resolveCartConflicts(localItems: CartItem[], serverItems: CartItem[]): CartItem[] {
  const mergedItems = new Map<string, CartItem>();
  
  // Add server items first
  serverItems.forEach(item => {
    mergedItems.set(item.id, item);
  });
  
  // Merge local items, preferring server items in case of conflicts
  localItems.forEach(item => {
    if (!mergedItems.has(item.id)) {
      mergedItems.set(item.id, item);
    }
  });
  
  return Array.from(mergedItems.values());
}

export const persistCartState = (items: CartItem[], pendingChanges?: CartItem[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Validate items before persisting
    const validItems = items
      .map(validateCartItem)
      .filter((item): item is CartItem => item !== null);

    const validPendingChanges = pendingChanges
      ?.map(validateCartItem)
      .filter((item): item is CartItem => item !== null);

    const cartState: CartState = {
      items: validItems,
      lastSynced: new Date().toISOString(),
      version: '1.0',
      pendingChanges: validPendingChanges
    };

    localStorage.setItem('cartState', JSON.stringify(cartState));
  } catch (error) {
    logger.error(error, 'Failed to persist cart state');
  }
};

export const loadCartState = (): CartState | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem('cartState');
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    return validateCartState(parsed);
  } catch (error) {
    logger.error(error, 'Error loading cart state');
    return null;
  }
}; 