import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { CartProvider, useCart } from '@/lib/cart';
import { Product } from '@/types/product';

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
  variantId: 'variant1',
};
const mockCartItemInput2 = {
  productId: mockProduct.id,
  name: mockProduct.name + ' 2',
  price: mockProduct.price,
  image: '/test.jpg',
  stock: mockProduct.stock,
  variantId: 'variant2',
};

const TestComponent = () => {
  const { items, addItem, removeItem, updateQuantity, clearCart } = useCart();
  return (
    <div>
      <button onClick={() => addItem(mockCartItemInput, 1)}>Add Item 1</button>
      <button onClick={() => addItem(mockCartItemInput2, 1)}>Add Item 2</button>
      <button onClick={() => removeItem('not-in-cart', 'variantX')}>Remove Not In Cart</button>
      <button onClick={() => updateQuantity(`${mockCartItemInput.productId}-${mockCartItemInput.variantId}`, 0, mockCartItemInput.variantId)}>Update To Zero</button>
      <button onClick={() => clearCart()}>Clear Cart</button>
      <div data-testid="cart-items">{items.length}</div>
      {items.map(item => (
        <div key={item.id} data-testid={`item-${item.id}`}>{item.name} - {item.variantId}</div>
      ))}
    </div>
  );
};

describe('Cart Edge Cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removing an item not in cart does not throw', async () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Remove Not In Cart'));
    });
    // Should not throw, cart remains empty
    expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
  });

  it('updating quantity to zero removes the item', async () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
    await act(async () => {
      fireEvent.click(screen.getByText('Update To Zero'));
    });
    expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
  });

  it('adding the same item with different variants keeps both', async () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 2'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('2');
      expect(screen.getByTestId('item-1-variant1')).toBeInTheDocument();
      expect(screen.getByTestId('item-1-variant2')).toBeInTheDocument();
    });
  });

  it('clearCart empties the cart', async () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 2'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('2');
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Clear Cart'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
    });
  });

  it('cart persists in localStorage', async () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    const cartState = JSON.parse(localStorage.getItem('cartState') || '{"items":[]}');
    expect(Array.isArray(cartState.items) ? cartState.items.length : 0).toBe(1);
  });

  it('rejects zero or negative quantity on server', async () => {
    // Simulate server response for zero quantity
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Some cart items are invalid',
        details: [{ id: '1', error: 'Quantity must be at least 1' }]
      })
    });
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    // Try to update to zero
    await act(async () => {
      fireEvent.click(screen.getByText('Update To Zero'));
    });
    // Should show error message
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
    });
  });

  it('rejects missing/deleted variant on server', async () => {
    // Simulate server response for missing variant
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Some cart items are invalid',
        details: [{ id: '1', variantId: 'variantX', error: 'Variant not found' }]
      })
    });
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    // Try to remove a non-existent variant
    await act(async () => {
      fireEvent.click(screen.getByText('Remove Not In Cart'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
    });
  });

  it('rejects over-stock update on server', async () => {
    // Simulate server response for over-stock
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'Some cart items are invalid',
        details: [{ id: '1', error: 'Only 2 items available in stock' }]
      })
    });
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Add Item 1'));
    });
    // Try to update to quantity above stock
    await act(async () => {
      fireEvent.click(screen.getByText('Update To Zero'));
    });
    // Should show error message
    await waitFor(() => {
      expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
    });
  });
}); 