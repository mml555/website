/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import PaymentPage from '../app/checkout/CheckoutPaymentPage';
import React from 'react';
import { CartProvider } from '../lib/cart';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user1', email: 'test@example.com' } }, status: 'authenticated' })
}));

jest.mock('@stripe/react-stripe-js', () => ({
  ...jest.requireActual('@stripe/react-stripe-js'),
  Elements: ({ children }: any) => <div>{children}</div>,
  useStripe: () => ({}),
  useElements: () => ({})
}));

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({})
}));

jest.mock('../lib/cart', () => ({
  ...jest.requireActual('../lib/cart'),
  useCart: () => ({
    items: [{ id: 'item1', productId: 'p1', name: 'Test Product', price: 100, quantity: 1 }],
    total: 100,
    isLoading: false,
    addItem: jest.fn(),
    removeItem: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
    itemCount: 1,
    error: null,
    clearError: jest.fn(),
    retrySync: jest.fn(),
    pendingChanges: [],
  })
}));

jest.mock('../components/checkout-form', () => {
  const MockedCheckoutForm = () => <div>Mocked CheckoutForm</div>;
  MockedCheckoutForm.displayName = 'MockedCheckoutForm';
  return MockedCheckoutForm;
});

const mockFetch = global.fetch as jest.Mock;

function renderWithCartProvider(ui: React.ReactElement) {
  return render(
    <CartProvider>{ui}</CartProvider>
  );
}

describe('PaymentPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up sessionStorage mocks for addresses and shipping rate
    sessionStorage.setItem('shippingAddress', JSON.stringify({ street: '123 Main', city: 'Town', state: 'CA', postalCode: '90001', country: 'USA' }));
    sessionStorage.setItem('billingAddress', JSON.stringify({ name: 'Test User', email: 'test@example.com', street: '123 Main', city: 'Town', state: 'CA', postalCode: '90001', country: 'USA' }));
    sessionStorage.setItem('shippingRate', JSON.stringify({ name: 'Express', rate: 10, estimatedDays: 2 }));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('shows loading spinner while loading', async () => {
    const spy = jest.spyOn(require('next-auth/react'), 'useSession');
    spy.mockReturnValue({ data: null, status: 'loading' });
    renderWithCartProvider(<PaymentPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading payment information/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('shows error if payment intent fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    renderWithCartProvider(<PaymentPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Failed to initialize payment/i)).toBeInTheDocument();
  });

  // More tests can be added for pay button, success, and redirect
}); 