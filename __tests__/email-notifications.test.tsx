import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface EmailContextType {
  sendOrderConfirmation: () => Promise<void>;
  sendShippingUpdate: () => Promise<void>;
  error: string | null;
  confirmationSent: boolean;
  shippingSent: boolean;
}

const EmailContext = React.createContext<EmailContextType | null>(null);
function useEmail() {
  const ctx = React.useContext(EmailContext);
  if (!ctx) throw new Error('useEmail must be used within EmailProvider');
  return ctx;
}
function EmailProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [shippingSent, setShippingSent] = useState(false);
  // Mock API
  const api = {
    sendOrderConfirmation: jest.fn(async () => {
      if (process.env.FAIL_CONFIRM === '1') throw new Error('Email delivery failed');
      return true;
    }),
    sendShippingUpdate: jest.fn(async () => {
      if (process.env.FAIL_SHIP === '1') throw new Error('Email delivery failed');
      return true;
    })
  };
  const sendOrderConfirmation = async () => {
    setError(null);
    try {
      await api.sendOrderConfirmation();
      setConfirmationSent(true);
    } catch (err: any) {
      setError(err.message || 'Email error');
    }
  };
  const sendShippingUpdate = async () => {
    setError(null);
    try {
      await api.sendShippingUpdate();
      setShippingSent(true);
    } catch (err: any) {
      setError(err.message || 'Email error');
    }
  };
  return (
    <EmailContext.Provider value={{ sendOrderConfirmation, sendShippingUpdate, error, confirmationSent, shippingSent }}>
      {children}
    </EmailContext.Provider>
  );
}

function TestComponent() {
  const { sendOrderConfirmation, sendShippingUpdate, error, confirmationSent, shippingSent } = useEmail();
  return (
    <div>
      <button onClick={sendOrderConfirmation}>Send Confirmation</button>
      <button onClick={sendShippingUpdate}>Send Shipping</button>
      <div data-testid="confirmation-sent">{confirmationSent ? 'yes' : 'no'}</div>
      <div data-testid="shipping-sent">{shippingSent ? 'yes' : 'no'}</div>
      <div data-testid="error">{error || ''}</div>
    </div>
  );
}

describe('Email Notifications', () => {
  it('should send order confirmation email', async () => {
    render(<EmailProvider><TestComponent /></EmailProvider>);
    await act(async () => {
      screen.getByText('Send Confirmation').click();
    });
    expect(screen.getByTestId('confirmation-sent').textContent).toBe('yes');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should send shipping update email', async () => {
    render(<EmailProvider><TestComponent /></EmailProvider>);
    await act(async () => {
      screen.getByText('Send Shipping').click();
    });
    expect(screen.getByTestId('shipping-sent').textContent).toBe('yes');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should handle email delivery failures', async () => {
    // Simulate failure by setting env var
    process.env.FAIL_CONFIRM = '1';
    render(<EmailProvider><TestComponent /></EmailProvider>);
    await act(async () => {
      screen.getByText('Send Confirmation').click();
    });
    expect(screen.getByTestId('confirmation-sent').textContent).toBe('no');
    expect(screen.getByTestId('error').textContent).toBe('Email delivery failed');
    process.env.FAIL_CONFIRM = undefined;
  });
}); 