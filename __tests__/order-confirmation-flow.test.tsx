import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface Order {
  id: string;
  status: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
}
interface OrderContextType {
  order: Order | null;
  error: string | null;
  sendConfirmation: () => Promise<void>;
  fetchOrder: (id: string) => Promise<void>;
  emailSent: boolean;
}

const OrderContext = React.createContext<OrderContextType | null>(null);
function useOrder() {
  const ctx = React.useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within OrderProvider');
  return ctx;
}
function OrderProvider({ children }: { children: ReactNode }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  // Mock API
  const api = {
    fetchOrder: jest.fn(async (id: string) => {
      if (id === 'notfound') throw new Error('Order not found');
      return {
        id,
        status: 'PAID',
        total: 100,
        items: [
          { name: 'Product A', quantity: 2, price: 30 },
          { name: 'Product B', quantity: 1, price: 40 }
        ]
      };
    }),
    sendConfirmation: jest.fn(async () => true)
  };
  const fetchOrder = async (id: string) => {
    setError(null);
    try {
      const o = await api.fetchOrder(id);
      setOrder(o);
    } catch (err: any) {
      setOrder(null);
      setError(err.message || 'Order error');
    }
  };
  const sendConfirmation = async () => {
    if (!order) return;
    await api.sendConfirmation();
    setEmailSent(true);
  };
  return (
    <OrderContext.Provider value={{ order, error, sendConfirmation, fetchOrder, emailSent }}>
      {children}
    </OrderContext.Provider>
  );
}

function TestComponent() {
  const { order, error, sendConfirmation, fetchOrder, emailSent } = useOrder();
  return (
    <div>
      <button onClick={() => fetchOrder('123')}>Fetch Order</button>
      <button onClick={() => fetchOrder('notfound')}>Fetch Missing</button>
      <button onClick={sendConfirmation}>Send Email</button>
      <div data-testid="order-summary">{order ? `Order #${order.id} - $${order.total}` : ''}</div>
      <div data-testid="order-items">{order ? order.items.map(i => i.name).join(',') : ''}</div>
      <div data-testid="error">{error || ''}</div>
      <div data-testid="email-sent">{emailSent ? 'yes' : 'no'}</div>
    </div>
  );
}

describe('Order Confirmation Flow', () => {
  it('should display order summary after successful payment', async () => {
    render(<OrderProvider><TestComponent /></OrderProvider>);
    await act(async () => {
      screen.getByText('Fetch Order').click();
    });
    expect(screen.getByTestId('order-summary').textContent).toContain('Order #123');
    expect(screen.getByTestId('order-items').textContent).toContain('Product A');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should send order confirmation email', async () => {
    render(<OrderProvider><TestComponent /></OrderProvider>);
    await act(async () => {
      screen.getByText('Fetch Order').click();
    });
    await act(async () => {
      screen.getByText('Send Email').click();
    });
    expect(screen.getByTestId('email-sent').textContent).toBe('yes');
  });

  it('should show error if order not found', async () => {
    render(<OrderProvider><TestComponent /></OrderProvider>);
    await act(async () => {
      screen.getByText('Fetch Missing').click();
    });
    expect(screen.getByTestId('order-summary').textContent).toBe('');
    expect(screen.getByTestId('error').textContent).toBe('Order not found');
  });
}); 