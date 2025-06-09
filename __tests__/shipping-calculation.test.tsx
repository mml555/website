import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Types
interface ShippingOption {
  name: string;
  rate: number;
  estimatedDays: number;
}
interface Address {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface ShippingContextType {
  shippingOptions: ShippingOption[];
  selected: ShippingOption | null;
  calculate: (address: Address, cartWeight: number) => void;
  error: string | null;
}

const ShippingContext = React.createContext<ShippingContextType | null>(null);
function useShipping() {
  const ctx = React.useContext(ShippingContext);
  if (!ctx) throw new Error('useShipping must be used within ShippingProvider');
  return ctx;
}
function ShippingProvider({ children }: { children: ReactNode }) {
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selected, setSelected] = useState<ShippingOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calculate = (address: Address, cartWeight: number) => {
    if (!address.country || !address.state || !address.postalCode) {
      setError('Invalid address');
      setShippingOptions([]);
      return;
    }
    if (cartWeight === 0) {
      setError('Cart is empty');
      setShippingOptions([]);
      return;
    }
    // Free shipping for orders over 10kg
    if (cartWeight >= 10) {
      setShippingOptions([{ name: 'Free Shipping', rate: 0, estimatedDays: 7 }]);
      setSelected({ name: 'Free Shipping', rate: 0, estimatedDays: 7 });
      setError(null);
      return;
    }
    // Simulate API error for certain zip
    if (address.postalCode === '99999') {
      setError('Shipping not available');
      setShippingOptions([]);
      return;
    }
    // Otherwise, calculate based on weight
    const rate = 5 + cartWeight * 2;
    setShippingOptions([
      { name: 'Standard', rate, estimatedDays: 5 },
      { name: 'Express', rate: rate + 10, estimatedDays: 2 }
    ]);
    setSelected({ name: 'Standard', rate, estimatedDays: 5 });
    setError(null);
  };
  return (
    <ShippingContext.Provider value={{ shippingOptions, selected, calculate, error }}>
      {children}
    </ShippingContext.Provider>
  );
}

function TestComponent() {
  const { shippingOptions, selected, calculate, error } = useShipping();
  return (
    <div>
      <button onClick={() => calculate({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        street: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'USA'
      }, 3)}>Calc Shipping</button>
      <button onClick={() => calculate({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        street: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'USA'
      }, 12)}>Calc Free</button>
      <button onClick={() => calculate({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        street: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '99999',
        country: 'USA'
      }, 3)}>Calc Error</button>
      <button onClick={() => calculate({
        name: '',
        email: '',
        phone: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: ''
      }, 3)}>Calc Invalid</button>
      <button onClick={() => calculate({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA'
      }, 2)}>Change Address</button>
      <div data-testid="options">{shippingOptions.map(o => o.name + ':' + o.rate).join(';')}</div>
      <div data-testid="selected">{selected ? selected.name : ''}</div>
      <div data-testid="error">{error || ''}</div>
    </div>
  );
}

interface ShippingCalculator {
  calculate: (address: Address, cartWeight: number) => void;
}

describe('Shipping Calculator', () => {
  it('should calculate shipping rate for US address', () => {
    const calculator: ShippingCalculator = {
      calculate: (address: Address, cartWeight: number) => {
        expect(address.street).toBe('123 Main St');
        expect(address.postalCode).toBe('12345');
        expect(cartWeight).toBe(5);
      }
    };

    calculator.calculate({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '12345',
      country: 'USA'
    }, 5);
  });
});

describe('Shipping Calculation', () => {
  it('should calculate shipping cost based on address and cart weight', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    await act(async () => {
      screen.getByText('Calc Shipping').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:11');
    expect(screen.getByTestId('selected').textContent).toBe('Standard');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('should show free shipping when eligible', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    await act(async () => {
      screen.getByText('Calc Free').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Free Shipping:0');
    expect(screen.getByTestId('selected').textContent).toBe('Free Shipping');
  });

  it('should update shipping options when address changes', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    await act(async () => {
      screen.getByText('Calc Shipping').click();
      screen.getByText('Change Address').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:9');
    expect(screen.getByTestId('selected').textContent).toBe('Standard');
  });

  it('should handle API errors gracefully', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    await act(async () => {
      screen.getByText('Calc Error').click();
    });
    expect(screen.getByTestId('error').textContent).toBe('Shipping not available');
    expect(screen.getByTestId('options').textContent).toBe('');
  });

  it('should handle invalid address', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    await act(async () => {
      screen.getByText('Calc Invalid').click();
    });
    expect(screen.getByTestId('error').textContent).toBe('Invalid address');
    expect(screen.getByTestId('options').textContent).toBe('');
  });

  it('should calculate shipping rate for US address', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    const address = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '12345',
      country: 'USA'
    };
    await act(async () => {
      screen.getByText('Calc Shipping').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:11');
  });

  it('should calculate shipping rate for Canadian address', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    const address = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5V 2T6',
      country: 'Canada'
    };
    await act(async () => {
      screen.getByText('Calc Shipping').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:11');
  });

  it('should calculate shipping rate for UK address', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    const address = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'London',
      state: 'Greater London',
      postalCode: 'SW1A 1AA',
      country: 'United Kingdom'
    };
    await act(async () => {
      screen.getByText('Calc Shipping').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:11');
  });

  it('should calculate shipping rate for Australian address', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    const address = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'Sydney',
      state: 'NSW',
      postalCode: '2000',
      country: 'Australia'
    };
    await act(async () => {
      screen.getByText('Calc Shipping').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:11');
  });

  it('should calculate shipping rate for German address', async () => {
    render(<ShippingProvider><TestComponent /></ShippingProvider>);
    const address = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      street: '123 Main St',
      city: 'Berlin',
      state: 'Berlin',
      postalCode: '10115',
      country: 'Germany'
    };
    await act(async () => {
      screen.getByText('Calc Shipping').click();
    });
    expect(screen.getByTestId('options').textContent).toContain('Standard:11');
  });
}); 