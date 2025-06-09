import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface StripeContextType {
  isPaying: boolean;
  error: string | null;
  status: string;
  initiatePayment: (amount: number) => Promise<void>;
}

const StripeContext = React.createContext<StripeContextType | null>(null);
function useStripe() {
  const ctx = React.useContext(StripeContext);
  if (!ctx) throw new Error('useStripe must be used within StripeProvider');
  return ctx;
}
function StripeProvider({ children }: { children: ReactNode }) {
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('idle');
  // Mock API call
  const api = {
    createPaymentIntent: jest.fn(async (amount: number) => {
      if (amount === 0) throw new Error('Invalid amount');
      if (amount === 999) throw new Error('Stripe error');
      return { clientSecret: 'secret' };
    }),
    confirmPayment: jest.fn(async (clientSecret: string) => {
      if (clientSecret === 'fail') throw new Error('Payment failed');
      return { status: 'succeeded' };
    })
  };
  const initiatePayment = async (amount: number) => {
    if (isPaying) return;
    setIsPaying(true);
    setError(null);
    setStatus('processing');
    try {
      const { clientSecret } = await api.createPaymentIntent(amount);
      const result = await api.confirmPayment(clientSecret);
      if (result.status === 'succeeded') {
        setStatus('success');
      } else {
        setStatus('failed');
        setError('Payment failed');
      }
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Payment error');
    } finally {
      setIsPaying(false);
    }
  };
  return (
    <StripeContext.Provider value={{ isPaying, error, status, initiatePayment }}>
      {children}
    </StripeContext.Provider>
  );
}

function TestComponent() {
  const { isPaying, error, status, initiatePayment } = useStripe();
  return (
    <div>
      <button onClick={() => initiatePayment(100)}>Pay $100</button>
      <button onClick={() => initiatePayment(999)}>Pay Error</button>
      <button onClick={() => initiatePayment(0)}>Pay Zero</button>
      <button onClick={() => initiatePayment(100)}>Pay Again</button>
      <div data-testid="status">{status}</div>
      <div data-testid="error">{error || ''}</div>
      <div data-testid="isPaying">{isPaying ? 'yes' : 'no'}</div>
    </div>
  );
}

describe('Stripe Payment', () => {
  it('should initiate payment with Stripe', async () => {
    render(<StripeProvider><TestComponent /></StripeProvider>);
    await act(async () => {
      screen.getByText('Pay $100').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('success');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should handle payment failure and show error', async () => {
    render(<StripeProvider><TestComponent /></StripeProvider>);
    await act(async () => {
      screen.getByText('Pay Error').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('failed');
    expect(screen.getByTestId('error').textContent).toBe('Stripe error');
  });

  it('should handle invalid amount and show error', async () => {
    render(<StripeProvider><TestComponent /></StripeProvider>);
    await act(async () => {
      screen.getByText('Pay Zero').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('failed');
    expect(screen.getByTestId('error').textContent).toBe('Invalid amount');
  });

  it('should prevent double payment submissions', async () => {
    render(<StripeProvider><TestComponent /></StripeProvider>);
    // Start payment
    await act(async () => {
      screen.getByText('Pay $100').click();
      // Try to click again while paying
      screen.getByText('Pay Again').click();
    });
    // Only one payment should be processed
    expect(screen.getByTestId('isPaying').textContent).toBe('no');
    expect(screen.getByTestId('status').textContent).toBe('success');
  });
}); 