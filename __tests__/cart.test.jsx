var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { CartProvider, useCart } from '@/lib/cart';
// Mock fetch for stock validation
global.fetch = jest.fn();
// Test component that uses the cart
const TestComponent = () => {
    const { items, addItem, removeItem, updateQuantity, total, itemCount, error, clearError } = useCart();
    const testProduct = {
        productId: '1',
        name: 'Test Product',
        price: 99.99,
        image: 'test.jpg'
    };
    return (<div>
      <button onClick={() => addItem(testProduct, 1)}>Add to Cart</button>
      <button onClick={() => removeItem('1')}>Remove from Cart</button>
      <button onClick={() => updateQuantity('1', 2)}>Update Quantity</button>
      <button onClick={() => clearError()}>Clear Error</button>
      <div data-testid="total-items">{itemCount}</div>
      <div data-testid="total-price">{total}</div>
      <div data-testid="cart-items">{items.length}</div>
      {error && <div data-testid="error-message">{error}</div>}
      {items.map(item => (<div key={item.productId} data-testid={`item-${item.productId}`}>
          {item.name} - Qty: {item.quantity}
        </div>))}
    </div>);
};
describe('Cart Context', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        global.fetch.mockReset();
    });
    const mockProduct = {
        productId: '1',
        name: 'Test Product',
        price: 99.99,
        quantity: 1,
        image: 'test.jpg',
    };
    const mockStockData = [
        { productId: '1', stock: 10, price: 99.99, name: 'Test Product' }
    ];
    const renderWithCart = (component) => {
        return render(<CartProvider>
        {component}
      </CartProvider>);
    };
    it('adds item to cart successfully', async () => {
        // Mock successful stock check
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockStockData),
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
    it('prevents adding more items than available stock', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock stock check with low stock for both add attempts
        global.fetch
            .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ productId: '1', stock: 2, name: 'Test Product' }])
        })
            .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ productId: '1', stock: 2, name: 'Test Product' }])
        });
        renderWithCart(<TestComponent />);
        // First add should succeed
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Add to Cart'));
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('cart-items')).toHaveTextContent('1');
        });
        // Second add should fail due to stock limit
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                fireEvent.click(screen.getByText('Add to Cart'));
            }
            catch (e) {
                // Ignore thrown error, focus on UI
            }
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent('Only 2 items available in stock for "Test Product"');
        });
    }));
    it('removes item from cart', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock successful stock check
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ productId: '1', stock: 10, name: 'Test Product' }])
        });
        renderWithCart(<TestComponent />);
        // Add item first
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Add to Cart'));
        }));
        // Then remove it
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Remove from Cart'));
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('cart-items')).toHaveTextContent('0');
            expect(screen.getByTestId('total-items')).toHaveTextContent('0');
            expect(screen.getByTestId('total-price')).toHaveTextContent('0');
        });
    }));
    it('updates item quantity within stock limits', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock successful stock check for add and update
        global.fetch
            .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
        })
            .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ id: '1', stock: 10, price: 99.99, name: 'Test Product' }])
        });
        renderWithCart(<TestComponent />);
        // Add item first
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Add to Cart'));
        }));
        // Then update quantity
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Update Quantity'));
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('total-items')).toHaveTextContent('2');
            expect(screen.getByTestId('total-price')).toHaveTextContent('199.98');
        });
    }));
    it('prevents updating quantity beyond stock limit', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock stock check for add and update (low stock for update)
        global.fetch
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
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Add to Cart'));
        }));
        // Try to update to quantity 2
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                fireEvent.click(screen.getByText('Update Quantity'));
            }
            catch (e) {
                // Ignore thrown error, focus on UI
            }
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent('Only 1 items available in stock for "Test Product"');
        });
    }));
    it('handles stock check API errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock failed stock check for both add and update
        global.fetch
            .mockRejectedValueOnce(new Error('API Error'))
            .mockRejectedValueOnce(new Error('API Error'));
        renderWithCart(<TestComponent />);
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                fireEvent.click(screen.getByText('Add to Cart'));
            }
            catch (e) {
                // Ignore thrown error, focus on UI
            }
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to check stock');
        });
    }));
    it('clears error message when clearError is called', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock failed stock check for both add and update
        global.fetch
            .mockRejectedValueOnce(new Error('API Error'))
            .mockRejectedValueOnce(new Error('API Error'));
        renderWithCart(<TestComponent />);
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Add to Cart'));
        }));
        yield waitFor(() => {
            expect(screen.getByTestId('error-message')).toBeInTheDocument();
        });
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            fireEvent.click(screen.getByText('Clear Error'));
        }));
        yield waitFor(() => {
            expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
        });
    }));
});
