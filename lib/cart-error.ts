import { logger } from '@/lib/logger';
import type { CartItem, CartState } from '@/types/cart';
import { validateCartItem, validateCartState } from './cart-utils';

export class CartError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'CartError';
  }
}

export const CartErrorCodes = {
  INVALID_ITEM: 'INVALID_ITEM',
  INVALID_STATE: 'INVALID_STATE',
  SYNC_FAILED: 'SYNC_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RECOVERY_FAILED: 'RECOVERY_FAILED'
} as const;

export type CartErrorCode = typeof CartErrorCodes[keyof typeof CartErrorCodes];

// Error recovery strategies
export const recoveryStrategies = {
  // Attempt to recover from invalid item
  recoverInvalidItem: (item: unknown): CartItem | null => {
    try {
      const recovered = validateCartItem(item);
      if (recovered) {
        logger.info('Successfully recovered invalid item');
        return recovered;
      }
      return null;
    } catch (error) {
      logger.error(error, 'Failed to recover invalid item');
      return null;
    }
  },

  // Attempt to recover from invalid state
  recoverInvalidState: (state: unknown): CartState | null => {
    try {
      const recovered = validateCartState(state);
      if (recovered) {
        logger.info('Successfully recovered invalid state');
        return recovered;
      }
      return null;
    } catch (error) {
      logger.error(error, 'Failed to recover invalid state');
      return null;
    }
  },

  // Attempt to recover from storage error
  recoverFromStorageError: async (): Promise<CartState | null> => {
    try {
      // Try to load from backup storage if available
      const backup = localStorage.getItem('cartState_backup');
      if (backup) {
        const recovered = validateCartState(JSON.parse(backup));
        if (recovered) {
          logger.info('Successfully recovered from backup storage');
          return recovered;
        }
      }
      return null;
    } catch (error) {
      logger.error(error, 'Failed to recover from storage error');
      return null;
    }
  },

  // Attempt to recover from sync error
  recoverFromSyncError: async (items: CartItem[]): Promise<CartItem[]> => {
    try {
      // Filter out items that failed to sync
      const validItems = items.filter(item => validateCartItem(item) !== null);
      if (validItems.length !== items.length) {
        logger.warn('Some items failed to sync, filtering them out');
      }
      return validItems;
    } catch (error) {
      logger.error(error, 'Failed to recover from sync error');
      return [];
    }
  }
};

// Error handler with recovery
export const handleCartError = async (
  error: unknown,
  context: {
    operation: string;
    items?: CartItem[];
    state?: CartState;
  }
): Promise<{ recovered: boolean; result: CartItem[] | CartState | null }> => {
  try {
    if (error instanceof CartError) {
      logger.error(error, `Cart error during ${context.operation}`);

      // Attempt recovery based on error code
      switch (error.code) {
        case CartErrorCodes.INVALID_ITEM:
          if (context.items) {
            const recoveredItems = context.items
              .map(recoveryStrategies.recoverInvalidItem)
              .filter((item): item is CartItem => item !== null);
            return { recovered: recoveredItems.length > 0, result: recoveredItems };
          }
          break;

        case CartErrorCodes.INVALID_STATE:
          if (context.state) {
            const recoveredState = recoveryStrategies.recoverInvalidState(context.state);
            return { recovered: recoveredState !== null, result: recoveredState };
          }
          break;

        case CartErrorCodes.STORAGE_ERROR:
          const recoveredState = await recoveryStrategies.recoverFromStorageError();
          return { recovered: recoveredState !== null, result: recoveredState };

        case CartErrorCodes.SYNC_FAILED:
          if (context.items) {
            const recoveredItems = await recoveryStrategies.recoverFromSyncError(context.items);
            return { recovered: recoveredItems.length > 0, result: recoveredItems };
          }
          break;
      }
    } else {
      logger.error(error, `Unexpected error during ${context.operation}`);
    }

    return { recovered: false, result: null };
  } catch (recoveryError) {
    logger.error(recoveryError, 'Error during recovery attempt');
    return { recovered: false, result: null };
  }
};

// Create backup of cart state
export const createCartBackup = (state: CartState): void => {
  try {
    localStorage.setItem('cartState_backup', JSON.stringify(state));
    logger.info('Created cart state backup');
  } catch (error) {
    logger.error(error, 'Failed to create cart state backup');
  }
};

// Restore from backup
export const restoreFromBackup = (): CartState | null => {
  try {
    const backup = localStorage.getItem('cartState_backup');
    if (!backup) return null;

    const state = validateCartState(JSON.parse(backup));
    if (state) {
      logger.info('Successfully restored from backup');
      return state;
    }
    return null;
  } catch (error) {
    logger.error(error, 'Failed to restore from backup');
    return null;
  }
}; 