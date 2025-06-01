import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { OrderProvider, useOrder } from '@/context/OrderContext';
import { CartProvider } from '@/lib/cart';
import CheckoutForm from '@/components/CheckoutForm';
import { useSession } from 'next-auth/react';
import React from 'react';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockOrder = {
  id: '1',
  userId: 'user1',
  items: [
    {
      id: '1',
      productId: 'prod1',
      quantity: 2,
      price: 99.99,
    },
  ],
  status: 'PENDING',
  total: 199.98,
  shippingAddress: {
    street: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    postalCode: '12345',
    country: 'Test Country',
  },
  billingAddress: {
    name: 'Test User',
    email: 'test@example.com',
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    zipCode: '12345',
    country: 'Test Country',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <CartProvider>
      <OrderProvider>{ui}</OrderProvider>
    </CartProvider>
  );
};

describe('Order Functionality', () => {
  beforeEach(() => {
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: {
          id: 'user1',
          email: 'test@example.com',
        },
      },
      status: 'authenticated',
    });
    (global.fetch as jest.Mock).mockClear();
  });

  it('creates a new order', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockOrder),
    });

    renderWithProviders(<CheckoutForm />);

    // Fill out the form
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/address/i), {
        target: { value: '123 Test St' },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: 'Test City' },
      });
      fireEvent.change(screen.getByLabelText(/state/i), {
        target: { value: 'Test State' },
      });
      fireEvent.change(screen.getByLabelText(/zip code/i), {
        target: { value: '12345' },
      });
      fireEvent.change(screen.getByLabelText(/country/i), {
        target: { value: 'Test Country' },
      });
    });

    // Submit the form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      });
    });
  });

  it('handles order creation errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed to create order' }),
    });

    renderWithProviders(<CheckoutForm />);

    // Fill out the form
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: 'Test User' },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/address/i), {
        target: { value: '123 Test St' },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: 'Test City' },
      });
      fireEvent.change(screen.getByLabelText(/state/i), {
        target: { value: 'Test State' },
      });
      fireEvent.change(screen.getByLabelText(/zip code/i), {
        target: { value: '12345' },
      });
      fireEvent.change(screen.getByLabelText(/country/i), {
        target: { value: 'Test Country' },
      });
    });

    // Submit the form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/failed to create order/i)).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    renderWithProviders(<CheckoutForm />);

    // Submit without filling required fields
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/address is required/i)).toBeInTheDocument();
    });
  });

  it('loads order history', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockOrder]),
    });

    const OrderHistory = () => {
      const { fetchOrders } = useOrder();
      React.useEffect(() => {
        fetchOrders();
      }, [fetchOrders]);
      return <div data-testid="order-history" />;
    };

    renderWithProviders(<OrderHistory />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  it('updates order status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockOrder, status: 'SHIPPED' }),
    });

    const OrderStatus = () => {
      const { updateOrderStatus } = useOrder();
      return (
        <div data-testid="order-status">
          <button onClick={() => updateOrderStatus(mockOrder.id, 'SHIPPED')}>
            Update Status
          </button>
        </div>
      );
    };

    renderWithProviders(<OrderStatus />);

    // Trigger status update
    fireEvent.click(screen.getByRole('button', { name: /update status/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/orders/${mockOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'SHIPPED' }),
      });
    });
  });
}); 