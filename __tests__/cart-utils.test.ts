import { validateCartItem, validateCartState, persistCartState, loadCartState } from '@/lib/cart-utils';
import type { CartItem, CartState, ProductCartItem, BaseCartItem } from '@/types/cart';
import { isProductCartItem, isBaseCartItem } from '@/types/cart';

describe('Cart Utilities', () => {
  const mockProductCartItem: ProductCartItem = {
    id: '1',
    productId: 'prod_1',
    variantId: 'var_1',
    quantity: 2,
    price: 19.99,
    name: 'Test Product',
    image: 'test.jpg',
    stock: 10,
    stockAtAdd: 10,
    type: 'add',
    originalPrice: 24.99,
    product: {
      id: 'prod_1',
      name: 'Test Product',
      price: 19.99,
      images: ['test.jpg'],
      stock: 10
    },
    variant: {
      id: 'var_1',
      name: 'Test Variant',
      type: 'size'
    }
  };

  const mockBaseCartItem: BaseCartItem = {
    id: '2',
    productId: 'prod_2',
    quantity: 1,
    price: 9.99,
    name: 'Test Base Item',
    image: 'test2.jpg',
    stock: 5,
    stockAtAdd: 5,
    type: 'add'
  };

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

  describe('validateCartItem', () => {
    it('should validate a valid product cart item', () => {
      const result = validateCartItem(mockProductCartItem);
      expect(result).toEqual(mockProductCartItem);
    });

    it('should validate a valid base cart item', () => {
      const result = validateCartItem(mockBaseCartItem);
      expect(result).toEqual(mockBaseCartItem);
    });

    it('should validate a valid cart item', () => {
      const result = validateCartItem(mockCartItem);
      expect(result).toEqual(mockCartItem);
    });

    it('should return null for invalid cart item', () => {
      const invalidItem = {
        id: '1',
        productId: 'prod_1',
        quantity: -1, // Invalid quantity
        price: 19.99,
        name: 'Test Product',
        image: 'test.jpg',
        stock: 10,
        stockAtAdd: 10,
        type: 'add'
      };

      const result = validateCartItem(invalidItem);
      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const invalidItem = {
        id: '1',
        productId: 'prod_1',
        quantity: 2,
        price: 19.99,
        // Missing name
        image: 'test.jpg',
        stock: 10,
        stockAtAdd: 10,
        type: 'add'
      };

      const result = validateCartItem(invalidItem);
      expect(result).toBeNull();
    });
  });

  describe('validateCartState', () => {
    it('should validate a valid cart state', () => {
      const result = validateCartState(mockCartState);
      expect(result).toEqual(mockCartState);
    });

    it('should return null for invalid cart state', () => {
      const invalidState = {
        items: [
          {
            id: '1',
            productId: 'prod_1',
            quantity: -1, // Invalid quantity
            price: 19.99,
            name: 'Test Product',
            image: 'test.jpg',
            stock: 10,
            stockAtAdd: 10,
            type: 'add'
          }
        ],
        lastSynced: new Date().toISOString(),
        version: '1.0'
      };

      const result = validateCartState(invalidState);
      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const invalidState = {
        items: [mockCartItem],
        // Missing lastSynced
        version: '1.0'
      };

      const result = validateCartState(invalidState);
      expect(result).toBeNull();
    });
  });

  describe('persistCartState and loadCartState', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should persist and load cart state', () => {
      persistCartState(mockCartState.items);
      const loaded = loadCartState();

      expect(loaded).toEqual(mockCartState);
    });

    it('should return null when cart state is missing', () => {
      const loaded = loadCartState();
      expect(loaded).toBeNull();
    });

    it('should return null when cart state is invalid', () => {
      localStorage.setItem('cartState', 'invalid-json');
      const loaded = loadCartState();
      expect(loaded).toBeNull();
    });

    it('should handle storage errors gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });

      persistCartState(mockCartState.items);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
}); 