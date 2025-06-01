/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CartProvider } from '../lib/cart';

// Mock useSession to return loading
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'loading' })
}));

// Mock useCart to return default values
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

import PaymentPage from '../app/checkout/payment/page';

function renderWithCartProvider(ui: React.ReactElement) {
  return render(
    <CartProvider>{ui}</CartProvider>
  );
}

describe('PaymentPage (loading state)', () => {
  it('shows loading spinner while loading', () => {
    // Set up sessionStorage mocks for addresses and shipping rate
    sessionStorage.setItem('shippingAddress', JSON.stringify({ street: '123 Main', city: 'Town', state: 'CA', postalCode: '90001', country: 'USA' }));
    sessionStorage.setItem('billingAddress', JSON.stringify({ name: 'Test User', email: 'test@example.com', street: '123 Main', city: 'Town', state: 'CA', postalCode: '90001', country: 'USA' }));
    sessionStorage.setItem('shippingRate', JSON.stringify({ name: 'Express', rate: 10, estimatedDays: 2 }));

    renderWithCartProvider(<PaymentPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading payment information/i)).toBeInTheDocument();

    sessionStorage.clear();
  });
}); 