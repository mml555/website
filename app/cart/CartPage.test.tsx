import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CartPage from './CartPage';
import * as cartModule from '@/lib/cart';
import { CartItem } from '@/types/product';
import React from 'react';

jest.mock('@/lib/cart');

const mockCartItem: CartItem = {
  id: '1',
  productId: '1',
  name: 'Test Product',
  price: 10,
  image: '/test.jpg',
  quantity: 2,
  stock: 5,
};

describe('CartPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton', () => {
    (cartModule.useCart as jest.Mock).mockReturnValue({ isLoading: true, items: [], error: null });
    render(<CartPage />);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('shows empty state', () => {
    (cartModule.useCart as jest.Mock).mockReturnValue({ isLoading: false, items: [], error: null });
    render(<CartPage />);
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('shows error and retry', () => {
    (cartModule.useCart as jest.Mock).mockReturnValue({ isLoading: false, items: [], error: 'Error!' });
    render(<CartPage />);
    expect(screen.getByRole('heading', { name: /error/i })).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Error!');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders cart items and allows quantity change', async () => {
    const updateQuantity = jest.fn();
    (cartModule.useCart as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [mockCartItem],
      error: null,
      updateQuantity,
      removeItem: jest.fn(),
      total: 20,
      cartExpiryWarning: null,
      isUpdating: {},
    });
    render(<CartPage />);
    expect(screen.getByText(/test product/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/quantity for test product/i);
    fireEvent.change(select, { target: { value: '3' } });
    await waitFor(() => expect(updateQuantity).toHaveBeenCalled());
  });

  it('removes item from cart', async () => {
    const removeItem = jest.fn();
    (cartModule.useCart as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [mockCartItem],
      error: null,
      updateQuantity: jest.fn(),
      removeItem,
      total: 20,
      cartExpiryWarning: null,
      isUpdating: {},
    });
    render(<CartPage />);
    const removeBtn = screen.getByRole('button', { name: /remove test product/i });
    fireEvent.click(removeBtn);
    await waitFor(() => expect(removeItem).toHaveBeenCalled());
  });

  it('shows order summary and checkout button', () => {
    (cartModule.useCart as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [mockCartItem],
      error: null,
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      total: 20,
      cartExpiryWarning: null,
      isUpdating: {},
    });
    render(<CartPage />);
    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /checkout/i })).toBeInTheDocument();
  });

  it('shows cart expiry warning', () => {
    (cartModule.useCart as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [mockCartItem],
      error: null,
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      total: 20,
      cartExpiryWarning: 'Expiring soon!',
      isUpdating: {},
    });
    render(<CartPage />);
    expect(screen.getByText(/expiring soon/i)).toBeInTheDocument();
  });

  it('has accessible region and heading', () => {
    (cartModule.useCart as jest.Mock).mockReturnValue({
      isLoading: false,
      items: [mockCartItem],
      error: null,
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      total: 20,
      cartExpiryWarning: null,
      isUpdating: {},
    });
    render(<CartPage />);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-labelledby', 'cart-heading');
    expect(screen.getByText(/shopping cart/i)).toHaveAttribute('id', 'cart-heading');
  });
}); 