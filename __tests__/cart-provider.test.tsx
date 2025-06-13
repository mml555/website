import { render, act, renderHook } from '@testing-library/react';
import { CartProvider, useCart } from '@/lib/cart-provider';
import { CartItem } from '@/types/cart';
import { memoizeCartCalculation, optimizeCartState } from '@/lib/cart-performance';

// Mock the performance functions
jest.mock('@/lib/cart-performance', () => ({
  memoizeCartCalculation: jest.fn((key, calculation) => calculation()),
  optimizeCartState: jest.fn((state) => state),
  debounceCartOperation: jest.fn((operation) => operation),
  optimizeCartItemUpdate: jest.fn((items, updatedItem) => [...items, updatedItem]),
  clearCalculationCache: jest.fn(),
  getCacheStats: jest.fn(() => ({ size: 0, keys: [], oldestEntry: 0, newestEntry: 0 }))
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('CartProvider', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should initialize with empty cart', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('should load cart from localStorage', () => {
    const savedCart = {
      items: [mockCartItem],
      lastSynced: new Date().toISOString(),
      version: '1.0'
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedCart));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([mockCartItem]);
    expect(result.current.total).toBe(39.98); // 2 * 19.99
    expect(result.current.itemCount).toBe(1);
  });

  it('should add item to cart', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(mockCartItem);
    });

    expect(result.current.items).toContainEqual(mockCartItem);
    expect(result.current.total).toBe(39.98);
    expect(result.current.itemCount).toBe(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should remove item from cart', async () => {
    const savedCart = {
      items: [mockCartItem],
      lastSynced: new Date().toISOString(),
      version: '1.0'
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedCart));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.removeItem(mockCartItem.id);
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should update item quantity', async () => {
    const savedCart = {
      items: [mockCartItem],
      lastSynced: new Date().toISOString(),
      version: '1.0'
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedCart));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.updateQuantity(mockCartItem.id, 3);
    });

    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.total).toBe(59.97); // 3 * 19.99
    expect(result.current.itemCount).toBe(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should clear cart', async () => {
    const savedCart = {
      items: [mockCartItem],
      lastSynced: new Date().toISOString(),
      version: '1.0'
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedCart));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CartProvider>{children}</CartProvider>
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.itemCount).toBe(0);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
}); 