import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { CartProvider, useCart } from '../lib/cart';

// Use jest for mocking and test lifecycle
beforeEach(() => {
  global.fetch = jest.fn();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

describe('Cart Sharing', () => {
  function TestComponent() {
    const { generateShareableCartLink, loadSharedCart, items, addItem, error } = useCart();
    const [shareError, setShareError] = React.useState('');
    return (
      <div>
        <button onClick={async () => {
          await addItem({ productId: 'p1', name: 'Test', price: 10, image: '' }, 1);
        }}>Add Item</button>
        <button
          onClick={async () => {
            const link = await generateShareableCartLink();
            if (!link) setShareError('Cannot share an empty cart.');
            if (link) screen.getByTestId('share-link').textContent = link;
          }}
          disabled={items.length === 0}
        >Share Cart</button>
        <button onClick={async () => {
          await loadSharedCart('share123');
        }}>Load Shared Cart</button>
        <div data-testid="share-link"></div>
        <div data-testid="cart-items">{items.length}</div>
        {(error || shareError) && <div data-testid="share-error">{error || shareError}</div>}
      </div>
    );
  }

  it('should generate a shareable cart link', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shareId: 'share123' })
    });
    render(<CartProvider><TestComponent /></CartProvider>);
    // Add item to cart
    await act(async () => {
      screen.getByText('Add Item').click();
    });
    // Generate share link
    await act(async () => {
      screen.getByText('Share Cart').click();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/cart/share', expect.anything());
  });

  it('should load a shared cart', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ id: 'p1', productId: 'p1', name: 'Test', price: 10, image: '', quantity: 1 }] })
    });
    render(<CartProvider><TestComponent /></CartProvider>);
    // Load shared cart
    await act(async () => {
      screen.getByText('Load Shared Cart').click();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/cart/share/share123');
    // Cart should have 1 item
    expect(screen.getByTestId('cart-items').textContent).toBe('1');
  });

  it('should handle expired or invalid cart links', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Invalid or expired cart link' })
    });
    render(<CartProvider><TestComponent /></CartProvider>);
    // Try to load an invalid/expired cart link
    await act(async () => {
      screen.getByText('Load Shared Cart').click();
    });
    // Should show error message
    expect(screen.getByTestId('share-error').textContent).toMatch(/invalid|expired|failed/i);
  });

  test.skip('should merge shared cart with existing cart on login', () => {
    // TODO: Simulate merging carts after login
    // Expect items from both carts to be present
  });

  test('should not allow sharing of empty carts', async () => {
    render(<CartProvider><TestComponent /></CartProvider>);
    // Ensure cart is empty
    expect(screen.getByTestId('cart-items').textContent).toBe('0');
    // Try to click share
    const shareBtn = screen.getByText('Share Cart');
    expect(shareBtn).toBeDisabled();
    // Optionally, simulate click and check for error message
    // await act(async () => { shareBtn.click(); });
    // expect(screen.getByTestId('share-error').textContent).toContain('empty');
  });
}); 