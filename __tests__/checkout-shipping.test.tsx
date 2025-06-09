/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import ShippingPage from '../app/checkout/shipping/page';
import React from 'react';
import { CartProvider } from '../lib/cart';
import { act } from 'react-dom/test-utils';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user1', email: 'test@example.com' } }, status: 'authenticated' })
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

const mockFetch = global.fetch as jest.Mock;

function renderWithCartProvider(ui: React.ReactElement) {
  return render(
    <CartProvider>{ui}</CartProvider>
  );
}

describe('ShippingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and displays address book for logged-in users', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ id: 'a1', street: '123 Main', city: 'Town', state: 'CA', postalCode: '90001', country: 'USA', county: '' }])
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ options: [{ name: 'Standard', rate: 5, estimatedDays: 5 }] })
    });
    renderWithCartProvider(<ShippingPage />);
    expect(await screen.findByText(/Choose a saved address/i)).toBeInTheDocument();
    expect(screen.getByText(/123 Main, Town, CA 90001/)).toBeInTheDocument();
  });

  it('shows loading spinner for address book', async () => {
    let resolve;
    mockFetch.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    renderWithCartProvider(<ShippingPage />);
    expect(screen.getByText(/Loading saved addresses/i)).toBeInTheDocument();
    resolve && (resolve as Function)({ ok: true, json: async () => [] });
  });

  it('shows error if address book fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    renderWithCartProvider(<ShippingPage />);
    expect(await screen.findByText(/Failed to load saved addresses/i)).toBeInTheDocument();
  });

  it('fetches and displays shipping options', async () => {
    mockFetch.mockImplementation((url) => {
      if (url === '/api/user/addresses') {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url === '/api/shipping/calculate') {
        return Promise.resolve({ ok: true, json: async () => ({ options: [{ name: 'Express', rate: 10, estimatedDays: 2 }] }) });
      }
      // Default mock for other endpoints
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    renderWithCartProvider(<ShippingPage />);
    // Fill required shipping address fields
    const street = screen.getByLabelText(/Street Address/i);
    const city = screen.getByLabelText(/City/i);
    const state = screen.getByLabelText(/^State$/i);
    const postalCode = screen.getByLabelText(/Postal Code/i);
    await act(async () => {
      fireEvent.change(street, { target: { value: '123 Main' } });
      fireEvent.blur(street);
      fireEvent.change(city, { target: { value: 'Town' } });
      fireEvent.blur(city);
      fireEvent.change(state, { target: { value: 'CA' } });
      fireEvent.blur(state);
    });
    // Wait for County field to appear
    const county = await screen.findByLabelText(/County/i);
    await act(async () => {
      fireEvent.change(county, { target: { value: 'Los Angeles' } });
      fireEvent.blur(county);
      fireEvent.change(postalCode, { target: { value: '90001' } });
      fireEvent.blur(postalCode);
    });
    expect(await screen.findByRole('radio', { name: /Express/ })).toBeInTheDocument();
  });

  it('disables submit button when loading', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    renderWithCartProvider(<ShippingPage />);
    const btn = screen.getByRole('button', { name: /continue to payment/i });
    expect(btn).toBeDisabled();
  });
}); 