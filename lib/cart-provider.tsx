import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import type { CartItem, CartItemInput, CartContextType, CartState, ProductCartItem, BaseCartItem } from '@/types/cart';
import { isProductCartItem, isBaseCartItem } from '@/types/cart';
import { validateCartItem, validateCartState, persistCartState, loadCartState } from './cart-utils';
import { CartError, CartErrorCodes, handleCartError, createCartBackup, restoreFromBackup } from './cart-error';
import {
  memoizeCartCalculation,
  batchCartOperations,
  optimizeCartState,
  debounceCartOperation,
  optimizeCartItemUpdate,
  clearCalculationCache
} from './cart-performance';
import { debounce } from 'lodash';

// Simple toast implementation
const useToast = () => ({
  toast: ({ title, description, variant }: { title: string; description: string; variant?: string }) => {
    console.log(`[${variant || 'info'}] ${title}: ${description}`);
  }
});

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<CartItem[]>([]);
  const itemsRef = useRef(items);

  // Find item in cart
  const findItem = useCallback((productId: string, variantId?: string): CartItem | undefined => {
    return items.find((item: CartItem) => {
      if (variantId && isProductCartItem(item)) {
        return item.productId === productId && item.variantId === variantId;
      }
      return item.productId === productId;
    });
  }, [items]);

  // Load cart on mount and session change
  useEffect(() => {
    const loadCart = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Try to load from localStorage first
        const savedState = loadCartState();
        if (savedState) {
          const optimizedState = optimizeCartState(savedState);
          setItems(optimizedState.items);
          setLastSynced(optimizedState.lastSynced);
          if (optimizedState.pendingChanges) {
            setPendingChanges(optimizedState.pendingChanges);
          }
        }

        // If user is logged in, sync with server
        if (session?.user) {
          await syncCart();
        }
      } catch (error) {
        const { recovered, result } = await handleCartError(error, {
          operation: 'loadCart',
          items: items
        });

        if (recovered && result) {
          if (Array.isArray(result)) {
            setItems(result);
          } else {
            const optimizedState = optimizeCartState(result);
            setItems(optimizedState.items);
            setLastSynced(optimizedState.lastSynced);
            if (optimizedState.pendingChanges) {
              setPendingChanges(optimizedState.pendingChanges);
            }
          }
        } else {
          setError(error instanceof Error ? error : new Error('Failed to load cart'));
          toast({
            title: 'Error',
            description: 'Failed to load your cart. Please try again.',
            variant: 'destructive'
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, [session?.user]);

  // Sync cart with server
  const syncCart = useCallback(async () => {
    if (!session?.user || isSyncing) return;

    try {
      setIsSyncing(true);
      setError(null);

      // Create backup before sync
      createCartBackup({
        items,
        lastSynced: lastSynced || new Date().toISOString(),
        version: '1.0',
        pendingChanges
      });

      const response = await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, pendingChanges })
      });

      if (!response.ok) {
        throw new CartError(
          'Failed to sync cart',
          CartErrorCodes.SYNC_FAILED,
          { status: response.status }
        );
      }

      const data = await response.json();
      const validatedItems = data.items
        .map(validateCartItem)
        .filter((item: CartItem | null): item is CartItem => item !== null);

      const optimizedItems = optimizeCartState({
        items: validatedItems,
        lastSynced: new Date().toISOString(),
        version: '1.0'
      }).items;

      setItems(optimizedItems);
      setPendingChanges([]);
      setLastSynced(new Date().toISOString());
      persistCartState(optimizedItems);

      if (validatedItems.length !== data.items.length) {
        logger.warn('Some items failed validation during sync');
      }
    } catch (error) {
      const { recovered, result } = await handleCartError(error, {
        operation: 'syncCart',
        items: items
      });

      if (recovered && result && Array.isArray(result)) {
        const optimizedItems = optimizeCartState({
          items: result,
          lastSynced: new Date().toISOString(),
          version: '1.0'
        }).items;
        setItems(optimizedItems);
        persistCartState(optimizedItems);
      } else {
        setError(error instanceof Error ? error : new Error('Failed to sync cart'));
        toast({
          title: 'Error',
          description: 'Failed to sync your cart. Changes will be saved locally.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [session?.user, items, pendingChanges, lastSynced]);

  // Debounced sync with performance optimization
  const debouncedSync = useCallback(
    debounceCartOperation(syncCart),
    [syncCart]
  );

  // Add item to cart
  const addItem = useCallback(async (input: CartItemInput) => {
    try {
      setError(null);
      const validatedItem = validateCartItem(input);
      
      if (!validatedItem) {
        throw new CartError(
          'Invalid item data',
          CartErrorCodes.INVALID_ITEM,
          { input }
        );
      }

      setItems(prevItems => {
        const existingItem = findItem(validatedItem.productId, input.variantId);
        return optimizeCartItemUpdate(
          prevItems,
          existingItem
            ? { ...existingItem, quantity: existingItem.quantity + validatedItem.quantity }
            : validatedItem
        );
      });

      setPendingChanges(prev => [...prev, validatedItem]);
      debouncedSync();
    } catch (error) {
      const { recovered, result } = await handleCartError(error, {
        operation: 'addItem',
        items: items
      });

      if (!recovered) {
        setError(error instanceof Error ? error : new Error('Failed to add item'));
        toast({
          title: 'Error',
          description: 'Failed to add item to cart. Please try again.',
          variant: 'destructive'
        });
      }
    }
  }, [items, findItem, debouncedSync]);

  // Remove item from cart
  const removeItem = useCallback(async (id: string, variantId?: string) => {
    try {
      setError(null);
      setItems(prevItems => prevItems.filter(item => item.id !== id));
      setPendingChanges(prev => prev.filter(item => item.id !== id));
      debouncedSync();
    } catch (error) {
      const { recovered, result } = await handleCartError(error, {
        operation: 'removeItem',
        items: items
      });

      if (!recovered) {
        setError(error instanceof Error ? error : new Error('Failed to remove item'));
        toast({
          title: 'Error',
          description: 'Failed to remove item from cart. Please try again.',
          variant: 'destructive'
        });
      }
    }
  }, [items, debouncedSync]);

  // Update item quantity
  const updateQuantity = useCallback(async (id: string, quantity: number, variantId?: string) => {
    try {
      setError(null);
      if (quantity <= 0) {
        await removeItem(id, variantId);
        return;
      }

      setItems(prevItems => {
        const item = prevItems.find(item => item.id === id);
        if (!item) return prevItems;
        return optimizeCartItemUpdate(prevItems, { ...item, quantity });
      });

      setPendingChanges(prev => {
        const item = prev.find(item => item.id === id);
        if (!item) return prev;
        return optimizeCartItemUpdate(prev, { ...item, quantity });
      });

      debouncedSync();
    } catch (error) {
      const { recovered, result } = await handleCartError(error, {
        operation: 'updateQuantity',
        items: items
      });

      if (!recovered) {
        setError(error instanceof Error ? error : new Error('Failed to update quantity'));
        toast({
          title: 'Error',
          description: 'Failed to update item quantity. Please try again.',
          variant: 'destructive'
        });
      }
    }
  }, [items, removeItem, debouncedSync]);

  // Clear cart
  const clearCart = useCallback(async () => {
    try {
      setError(null);
      setItems([]);
      setPendingChanges([]);
      persistCartState([]);
      clearCalculationCache();
      
      if (session?.user) {
        const response = await fetch('/api/cart/clear', {
          method: 'POST'
        });

        if (!response.ok) {
          throw new CartError(
            'Failed to clear cart',
            CartErrorCodes.SYNC_FAILED,
            { status: response.status }
          );
        }
      }
    } catch (error) {
      const { recovered, result } = await handleCartError(error, {
        operation: 'clearCart',
        items: items
      });

      if (!recovered) {
        setError(error instanceof Error ? error : new Error('Failed to clear cart'));
        toast({
          title: 'Error',
          description: 'Failed to clear cart. Please try again.',
          variant: 'destructive'
        });
      }
    }
  }, [session?.user, items]);

  // Calculate cart totals with memoization
  const total = memoizeCartCalculation(
    `total-${items.length}`,
    () => items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  );

  const itemCount = memoizeCartCalculation(
    `count-${items.length}`,
    () => items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const value: CartContextType = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    itemCount,
    error: error?.message || null,
    clearError: () => setError(null),
    isLoading,
    retrySync: syncCart,
    pendingChanges,
    cartExpiryWarning: null,
    generateShareableCartLink: async () => null,
    loadSharedCart: async () => false,
    savedForLater: [],
    moveToSaveForLater: () => {},
    moveToCartFromSaveForLater: () => {}
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
} 