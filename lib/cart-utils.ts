import type { CartItem } from '@/types/product';

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
    } catch (error) {
      console.error('Error processing cart operation:', error);
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

export function validateCartItem(item: any): item is CartItem {
  const valid = (
    typeof item === 'object' &&
    typeof item.productId === 'string' &&
    !!item.productId &&
    typeof item.quantity === 'number' &&
    item.quantity > 0
    // Add more checks as needed (e.g., name, price, etc.)
  );
  if (!valid) {
    // Log which fields are invalid
    const reasons = [];
    if (typeof item !== 'object') reasons.push('item is not an object');
    if (!item.productId || typeof item.productId !== 'string') reasons.push('missing or invalid productId');
    if (typeof item.quantity !== 'number' || item.quantity <= 0) reasons.push('missing or invalid quantity');
    // Optionally check for name, price, etc.
    if (!item.name || typeof item.name !== 'string') reasons.push('missing or invalid name');
    if (typeof item.price !== 'number' || isNaN(item.price)) reasons.push('missing or invalid price');
    if (!item.image || typeof item.image !== 'string') reasons.push('missing or invalid image');
    console.warn('[Cart] validateCartItem failed:', item, 'Reasons:', reasons);
  }
  return valid;
}

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
    const cartState: CartState = {
      items,
      lastSynced: new Date().toISOString(),
      version: '1.0',
      pendingChanges
    };
    localStorage.setItem('cartState', JSON.stringify(cartState));
  } catch (error) {
    console.error('Failed to persist cart state:', error);
  }
};

export const loadCartState = (): CartState | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const savedState = localStorage.getItem('cartState');
    if (!savedState) return null;
    
    const state = JSON.parse(savedState) as CartState;
    return state;
  } catch (error) {
    console.error('Failed to load cart state:', error);
    return null;
  }
}; 