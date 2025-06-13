import {
  memoizeCartCalculation,
  batchCartOperations,
  optimizeCartState,
  debounceCartOperation,
  optimizeCartItemUpdate,
  clearCalculationCache,
  getCacheStats
} from '@/lib/cart-performance';
import type { CartItem, CartState } from '@/types/cart';

describe('Cart Performance', () => {
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

  describe('memoizeCartCalculation', () => {
    beforeEach(() => {
      clearCalculationCache();
    });

    it('should memoize calculation results', () => {
      const calculation = jest.fn(() => 42);
      const key = 'test-calculation';

      const result1 = memoizeCartCalculation(key, calculation);
      const result2 = memoizeCartCalculation(key, calculation);

      expect(calculation).toHaveBeenCalledTimes(1);
      expect(result1).toBe(42);
      expect(result2).toBe(42);
    });

    it('should recalculate after cache expiry', async () => {
      const calculation = jest.fn(() => 42);
      const key = 'test-calculation';

      const result1 = memoizeCartCalculation(key, calculation, 100);
      await new Promise(resolve => setTimeout(resolve, 150));
      const result2 = memoizeCartCalculation(key, calculation, 100);

      expect(calculation).toHaveBeenCalledTimes(2);
      expect(result1).toBe(42);
      expect(result2).toBe(42);
    });
  });

  describe('batchCartOperations', () => {
    it('should process operations in batches', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        jest.fn().mockResolvedValue(`result-${i}`)
      );

      const results = await batchCartOperations(operations, 3);

      expect(results).toHaveLength(10);
      expect(results[0]).toBe('result-0');
      expect(results[1]).toBe('result-1');
      expect(results[2]).toBe('result-2');
      expect(results[3]).toBe('result-3');
      expect(results[4]).toBe('result-4');
      expect(results[5]).toBe('result-5');
      expect(results[6]).toBe('result-6');
      expect(results[7]).toBe('result-7');
      expect(results[8]).toBe('result-8');
      expect(results[9]).toBe('result-9');
    });
  });

  describe('optimizeCartState', () => {
    it('should remove duplicate items', () => {
      const duplicateItems = [
        mockCartItem,
        { ...mockCartItem, id: '2' },
        { ...mockCartItem, id: '3' }
      ];

      const optimized = optimizeCartState({
        ...mockCartState,
        items: duplicateItems
      });

      expect(optimized.items).toHaveLength(1);
      expect(optimized.items[0]).toEqual(mockCartItem);
    });

    it('should sort items by last modified time', () => {
      const items = [
        { ...mockCartItem, id: '1', stockAtAdd: new Date('2023-01-01').getTime() },
        { ...mockCartItem, id: '2', stockAtAdd: new Date('2023-01-03').getTime() },
        { ...mockCartItem, id: '3', stockAtAdd: new Date('2023-01-02').getTime() }
      ];

      const optimized = optimizeCartState({
        ...mockCartState,
        items
      });

      expect(optimized.items[0].id).toBe('2');
      expect(optimized.items[1].id).toBe('3');
      expect(optimized.items[2].id).toBe('1');
    });
  });

  describe('debounceCartOperation', () => {
    it('should debounce operations', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      const debounced = debounceCartOperation(operation);

      const promise1 = debounced();
      const promise2 = debounced();
      const promise3 = debounced();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(operation).toHaveBeenCalledTimes(1);
      expect(await promise1).toBe('result');
      expect(await promise2).toBe('result');
      expect(await promise3).toBe('result');
    });
  });

  describe('optimizeCartItemUpdate', () => {
    it('should update existing item', () => {
      const items = [mockCartItem];
      const updatedItem = { ...mockCartItem, quantity: 3 };

      const result = optimizeCartItemUpdate(items, updatedItem);

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(3);
    });

    it('should add new item', () => {
      const items = [mockCartItem];
      const newItem = { ...mockCartItem, id: '2' };

      const result = optimizeCartItemUpdate(items, newItem);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(newItem);
    });
  });

  describe('getCacheStats', () => {
    beforeEach(() => {
      clearCalculationCache();
    });

    it('should return cache statistics', () => {
      const key = 'test-calculation';
      memoizeCartCalculation(key, () => 42);

      const stats = getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.keys).toContain(key);
      expect(stats.oldestEntry).toBeLessThanOrEqual(Date.now());
      expect(stats.newestEntry).toBeLessThanOrEqual(Date.now());
    });
  });
}); 