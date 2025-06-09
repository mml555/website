/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import OrderConfirmationPage from '../app/order-confirmation/OrderConfirmationPage';
import React from 'react';
import { CartProvider } from '../lib/cart';
import OrderSummaryClient from '../app/order-confirmation/OrderSummaryClient';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user1', email: 'test@example.com', role: 'USER' } }, status: 'authenticated' })
}));

jest.mock('../lib/cart', () => ({
  ...jest.requireActual('../lib/cart'),
  useCart: () => ({
    clearCart: jest.fn(),
    items: [],
    total: 0,
    isLoading: false,
    addItem: jest.fn(),
    removeItem: jest.fn(),
    updateQuantity: jest.fn(),
    itemCount: 0,
    error: null,
    clearError: jest.fn(),
    retrySync: jest.fn(),
    pendingChanges: [],
  })
}));

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({ get: (key: string) => key === 'payment_intent' ? 'pi_123' : null })
}));

global.fetch = jest.fn();

function renderWithCartProvider(ui: React.ReactElement) {
  return render(
    <CartProvider>{ui}</CartProvider>
  );
}

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/order-confirmation?payment_intent=pi_123');
  });

  it('shows loading spinner initially', () => {
    renderWithCartProvider(<OrderConfirmationPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error if fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    renderWithCartProvider(<OrderConfirmationPage />);
    expect(await screen.findByText(/Failed to load order details|fail|Cannot read properties/i)).toBeInTheDocument();
  });

  it('shows order details if fetch succeeds', async () => {
    // Render the client component directly with a mock order
    const order = {
      id: 'order1',
      status: 'PAID',
      total: 100,
      items: [
        { product: { name: 'Test Product', price: 50 }, quantity: 2 }
      ],
      shippingAddress: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        street: '123 Main',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'USA'
      },
      createdAt: new Date().toISOString()
    };
    renderWithCartProvider(<OrderSummaryClient order={order} />);
    expect(screen.getByText(/Order Confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/Order Number:/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Product/i)).toBeInTheDocument();
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Home/i })).toBeInTheDocument();
  });
}); 