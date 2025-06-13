import { CartItem, CartState } from '@/types/cart';
import { logger } from '@/lib/logger';

// Cache entry type
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

// Cache for cart calculations
const calculationCache = new Map<string, CacheEntry<unknown>>();

// Memoize cart calculations
export const memoizeCartCalculation = <T>(
  key: string,
  calculation: () => T,
  ttl: number = 5000 // 5 seconds default TTL
): T => {
  const cached = calculationCache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.value;
  }

  const result = calculation();
  calculationCache.set(key, {
    value: result,
    timestamp: Date.now()
  });

  return result;
};

// Batch cart operations
export const batchCartOperations = <T>(
  operations: (() => Promise<T>)[],
  batchSize: number = 5
): Promise<T[]> => {
  const results: T[] = [];
  const batches = [];

  // Split operations into batches
  for (let i = 0; i < operations.length; i += batchSize) {
    batches.push(operations.slice(i, i + batchSize));
  }

  // Process batches sequentially
  return batches.reduce(
    (promiseChain, batch) =>
      promiseChain.then(async (chainResults) => {
        const batchResults = await Promise.all(
          batch.map((operation) => operation())
        );
        return [...chainResults, ...batchResults];
      }),
    Promise.resolve(results)
  );
};

// Optimize cart state updates
export const optimizeCartState = (state: CartState): CartState => {
  try {
    // Remove duplicate items
    const uniqueItems = state.items.reduce((acc: CartItem[], item) => {
      const existingIndex = acc.findIndex(
        (existing) => existing.id === item.id
      );
      if (existingIndex === -1) {
        acc.push(item);
      } else {
        // Merge quantities for duplicate items
        acc[existingIndex] = {
          ...acc[existingIndex],
          quantity: acc[existingIndex].quantity + item.quantity
        };
      }
      return acc;
    }, []);

    // Sort items by last modified
    const sortedItems = uniqueItems.sort((a, b) => {
      const aTime = a.stockAtAdd || 0;
      const bTime = b.stockAtAdd || 0;
      return bTime - aTime;
    });

    return {
      ...state,
      items: sortedItems
    };
  } catch (error) {
    logger.error(error, 'Error optimizing cart state');
    return state;
  }
};

// Debounce cart operations
export const debounceCartOperation = <T>(
  operation: () => Promise<T>,
  delay: number = 1000
): (() => Promise<T>) => {
  let timeoutId: NodeJS.Timeout;
  let lastPromise: Promise<T> | null = null;

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          if (lastPromise) {
            // Wait for previous operation to complete
            await lastPromise;
          }
          lastPromise = operation();
          const result = await lastPromise;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
};

// Optimize cart item updates
export const optimizeCartItemUpdate = (
  items: CartItem[],
  updatedItem: CartItem
): CartItem[] => {
  try {
    // Find and update item
    const index = items.findIndex((item) => item.id === updatedItem.id);
    if (index === -1) {
      return [...items, updatedItem];
    }

    // Create new array with updated item
    const newItems = [...items];
    newItems[index] = updatedItem;

    // Sort items by last modified
    return newItems.sort((a, b) => {
      const aTime = a.stockAtAdd || 0;
      const bTime = b.stockAtAdd || 0;
      return bTime - aTime;
    });
  } catch (error) {
    logger.error(error, 'Error optimizing cart item update');
    return items;
  }
};

// Clear calculation cache
export const clearCalculationCache = (): void => {
  calculationCache.clear();
};

// Get cache statistics
export const getCacheStats = (): {
  size: number;
  keys: string[];
  oldestEntry: number;
  newestEntry: number;
} => {
  const keys = Array.from(calculationCache.keys());
  const timestamps = Array.from(calculationCache.values()).map(
    (entry) => (entry as CacheEntry<unknown>).timestamp
  );

  return {
    size: calculationCache.size,
    keys,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps)
  };
}; 