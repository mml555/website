import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { CartProvider, useCart } from '@/lib/cart';
import { Product } from '@/types/product';

// Mock fetch for stock validation
global.fetch = jest.fn();

const mockProduct: Product = {
  id: '1',
  name: 'Test Product',
  description: 'Test Description',
  price: 99.99,
  stock: 10,
  images: ['/test.jpg'],
  categoryId: 'cat1',
  category: { id: 'cat1', name: 'Test Category' },
  weight: 1,
  sku: 'SKU1',
  featured: false,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCartItemInput = {
  productId: mockProduct.id,
  name: mockProduct.name,
  price: mockProduct.price,
  image: '/test.jpg',
  stock: mockProduct.stock,
  variantId: 'variant1'
};

// Add a second mock item with a different variantId
const mockCartItemInput2 = {
  productId: mockProduct.id,
  name: mockProduct.name + ' 2',
  price: mockProduct.price,
  image: '/test.jpg',
  stock: mockProduct.stock,
  variantId: 'variant2'
};

// Helper to expose cart context for tests
let testCartContext: any = null;
const CartContextSpy = ({ children }: { children: React.ReactNode }) => {
  testCartContext = useCart();
  return <>{children}</>;
};

// Test component that uses the cart
const TestComponent = () => {
  const { items, addItem, removeItem, updateQuantity, total, itemCount, error, clearError } = useCart();
  
  return (
    <div>
      <button onClick={() => addItem(mockCartItemInput, 1)}>Add to Cart</button>
      <button onClick={() => addItem(mockCartItemInput2, 1)}>Add Second Item</button>
      <button onClick={() => removeItem(mockProduct.id, 'variant1')}>Remove from Cart</button>
      <button onClick={() => updateQuantity(mockProduct.id, 2, 'variant1')}>Update Quantity</button>
      <button onClick={() => clearError()}>Clear Error</button>
      <div data-testid="total-items">{itemCount}</div>
      <div data-testid="total-price">{total}</div>
      <div data-testid="cart-items">{items.length}</div>
      {error && <div data-testid="error-message">{error}</div>}
      {items.map(item => (
        <div key={item.id} data-testid={`item-${item.id}`}>
          {item.name} - Qty: {item.quantity}
        </div>
      ))}
    </div>
  );
};

describe('Cart Context', () => {
  let renderResult: ReturnType<typeof render> | undefined;
  beforeEach(() => {
    // Reset fetch mock before each test
    (global.fetch as jest.Mock).mockReset();
    // Unmount previous render if exists
    if (renderResult && renderResult.unmount) {
      renderResult.unmount();
    }
  });

  const renderWithCart = (component: React.ReactNode) => {
    renderResult = render(
      <CartProvider>
        <CartContextSpy>{component}</CartContextSpy>
      </CartProvider>
    );
    return renderResult;
  };

  it('adds item to cart successfully', async () => {
    // Mock successful stock check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
    });

    renderWithCart(<TestComponent />);
    
    await act(async () => {
      fireEvent.click(screen.getByText('Add to Cart'));
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
      expect(screen.getByTestId('total-price')).toHaveTextContent('99.99');
    });
  });

  it('prevents adding more items than available stock', async () => {
    // Mock stock check with low stock for both add attempts
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 2, price: 99.99, name: 'Test Product' }])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 2, price: 99.99, name: 'Test Product' }])
      });

    renderWithCart(<TestComponent />);
    // First add should succeed
    await act(async () => {
      fireEvent.click(screen.getByText('Add to Cart'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
    });
    // Second add should fail due to stock limit
    await act(async () => {
      try {
        await fireEvent.click(screen.getByText('Add to Cart'));
      } catch (e) {
        // Ignore thrown error, focus on UI
      }
    });
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Only 2 items available in stock for "Test Product"');
    });
  });

  it('removes item from cart', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
    });
    const { getByText, getByTestId } = renderWithCart(<TestComponent />);
    const addButton = getByText('Add to Cart');
    const removeButton = getByText('Remove from Cart');

    await act(async () => {
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(getByTestId('cart-items')).toHaveTextContent('1');
    });

    await act(async () => {
      await testCartContext.removeItem('1-variant1', 'variant1');
    });

    await waitFor(() => {
      expect(getByTestId('cart-items')).toHaveTextContent('0');
      expect(getByTestId('total-items')).toHaveTextContent('0');
      expect(getByTestId('total-price')).toHaveTextContent('0');
    });
  });

  it('updates item quantity within stock limits', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
      });
    const { getByText, getByTestId } = renderWithCart(<TestComponent />);
    const addButton = getByText('Add to Cart');
    const updateButton = getByText('Update Quantity');

    await act(async () => {
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(getByTestId('cart-items')).toHaveTextContent('1');
    });

    await act(async () => {
      await testCartContext.updateQuantity('1-variant1', 2, 'variant1');
    });

    await waitFor(() => {
      expect(getByTestId('total-items')).toHaveTextContent('2');
      expect(getByTestId('total-price')).toHaveTextContent('199.98');
    });
  });

  it('prevents updating quantity beyond stock limit', async () => {
    // Mock stock check for add and update (low stock for update)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 1, price: 99.99, name: 'Test Product' }])
      });

    renderWithCart(<TestComponent />);
    // Add item first
    await act(async () => {
      fireEvent.click(screen.getByText('Add to Cart'));
    });
    // Try to update to quantity 2 using the correct cart item id
    await act(async () => {
      try {
        await testCartContext.updateQuantity('1-variant1', 2, 'variant1');
      } catch (e) {
        // Ignore thrown error, focus on UI
      }
    });
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Only 1 items available in stock for "Test Product"');
    });
  });

  it('handles stock check API errors gracefully', async () => {
    // Mock failed stock check
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    renderWithCart(<TestComponent />);
    await act(async () => {
      try {
        await fireEvent.click(screen.getByText('Add to Cart'));
      } catch (e) {
        // Ignore thrown error, focus on UI
      }
    });
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to check stock');
    });
  });

  it('clears error message when clearError is called', async () => {
    // Mock failed stock check
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    renderWithCart(<TestComponent />);
    await act(async () => {
      try {
        await fireEvent.click(screen.getByText('Add to Cart'));
      } catch (e) {
        // Ignore thrown error, focus on UI
      }
    });
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Clear Error'));
    });
    // Wait for error message to disappear
    await waitFor(() => {
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });
  });

  it('adds two unique items to cart and keys are unique', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product 2' }])
      });

    renderWithCart(<TestComponent />);

    await act(async () => {
      fireEvent.click(screen.getByText('Add to Cart'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Add Second Item'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('2');
      expect(screen.getByTestId('item-1-variant1')).toBeInTheDocument();
      expect(screen.getByTestId('item-1-variant2')).toBeInTheDocument();
    });
  });
}); 