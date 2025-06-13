import { CartError, CartErrorCodes, handleCartError, createCartBackup, restoreFromBackup } from '@/lib/cart-error';
import type { CartItem, CartState } from '@/types/cart';

describe('Cart Error Handling', () => {
  const mockCartItem: CartItem = {
    id: '1',
    productId: 'prod_1',
    quantity: 2,
    price: 19.99,
    name: 'Test Product',
    image: 'test.jpg',
    stock: 10,
    stockAtAdd: 10,
    type: 'add'
  };

  const mockCartState: CartState = {
    items: [mockCartItem],
    lastSynced: new Date().toISOString(),
    version: '1.0'
  };

  describe('CartError', () => {
    it('should create a cart error with code and details', () => {
      const error = new CartError(
        'Test error',
        CartErrorCodes.INVALID_ITEM,
        { itemId: '1' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(CartErrorCodes.INVALID_ITEM);
      expect(error.details).toEqual({ itemId: '1' });
    });

    it('should create a cart error without details', () => {
      const error = new CartError(
        'Test error',
        CartErrorCodes.INVALID_STATE
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(CartErrorCodes.INVALID_STATE);
      expect(error.details).toBeUndefined();
    });
  });

  describe('handleCartError', () => {
    it('should handle CartError with recovery', async () => {
      const error = new CartError(
        'Test error',
        CartErrorCodes.INVALID_ITEM,
        { itemId: '1' }
      );

      const result = await handleCartError(error, {
        operation: 'test',
        items: [mockCartItem]
      });

      expect(result.recovered).toBe(true);
      expect(result.result).toEqual([mockCartItem]);
    });

    it('should handle non-CartError', async () => {
      const error = new Error('Test error');

      const result = await handleCartError(error, {
        operation: 'test',
        items: [mockCartItem]
      });

      expect(result.recovered).toBe(false);
      expect(result.result).toBeNull();
    });

    it('should handle error with no recovery possible', async () => {
      const error = new CartError(
        'Test error',
        CartErrorCodes.SYNC_FAILED
      );

      const result = await handleCartError(error, {
        operation: 'test'
      });

      expect(result.recovered).toBe(false);
      expect(result.result).toBeNull();
    });
  });

  describe('createCartBackup and restoreFromBackup', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should create and restore cart backup', () => {
      createCartBackup(mockCartState);
      const restored = restoreFromBackup();

      expect(restored).toEqual(mockCartState);
    });

    it('should return null when backup is missing', () => {
      const restored = restoreFromBackup();
      expect(restored).toBeNull();
    });

    it('should return null when backup is invalid', () => {
      localStorage.setItem('cartState_backup', 'invalid-json');
      const restored = restoreFromBackup();
      expect(restored).toBeNull();
    });
  });
}); 