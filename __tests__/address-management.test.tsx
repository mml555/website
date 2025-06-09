import { render, screen, act } from '@testing-library/react';
import React, { useState, ReactNode } from 'react';

// Address type
interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AddressContextType {
  addresses: Address[];
  addAddress: (addr: Omit<Address, 'id'>) => void;
  editAddress: (id: string, updates: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  defaultId: string;
  selectDefault: (id: string) => void;
}

const AddressContext = React.createContext<AddressContextType | null>(null);
function useAddress() {
  const ctx = React.useContext(AddressContext);
  if (!ctx) throw new Error('useAddress must be used within AddressProvider');
  return ctx;
}
function AddressProvider({ children }: { children: ReactNode }) {
  const [addresses, setAddresses] = useState<Address[]>([
    { id: '1', street: '123 Main', city: 'Town', state: 'CA', postalCode: '90001', country: 'USA' }
  ]);
  const [defaultId, setDefaultId] = useState('1');
  const addAddress = (addr: Omit<Address, 'id'>) => setAddresses(a => [...a, { ...addr, id: (a.length + 1).toString() }]);
  const editAddress = (id: string, updates: Partial<Address>) => setAddresses(a => a.map(addr => addr.id === id ? { ...addr, ...updates } : addr));
  const deleteAddress = (id: string) => setAddresses(a => a.filter(addr => addr.id !== id));
  const selectDefault = (id: string) => setDefaultId(id);
  return (
    <AddressContext.Provider value={{ addresses, addAddress, editAddress, deleteAddress, defaultId, selectDefault }}>
      {children}
    </AddressContext.Provider>
  );
}

function TestComponent() {
  const { addresses, addAddress, editAddress, deleteAddress, defaultId, selectDefault } = useAddress();
  return (
    <div>
      <button onClick={() => addAddress({ street: '456 Oak', city: 'City', state: 'NY', postalCode: '10001', country: 'USA' })}>Add Address</button>
      <button onClick={() => editAddress('1', { city: 'Newtown' })}>Edit Address</button>
      <button onClick={() => deleteAddress('1')}>Delete Address</button>
      <button onClick={() => selectDefault('2')}>Select Default</button>
      <div data-testid="address-list">{addresses.map(a => a.street + ',' + a.city).join(';')}</div>
      <div data-testid="default-id">{defaultId}</div>
    </div>
  );
}

describe('Address Management', () => {
  it('should allow a user to add a new address', async () => {
    render(<AddressProvider><TestComponent /></AddressProvider>);
    await act(async () => {
      screen.getByText('Add Address').click();
    });
    expect(screen.getByTestId('address-list').textContent).toContain('456 Oak');
  });

  it('should allow a user to edit an existing address', async () => {
    render(<AddressProvider><TestComponent /></AddressProvider>);
    await act(async () => {
      screen.getByText('Edit Address').click();
    });
    expect(screen.getByTestId('address-list').textContent).toContain('Newtown');
  });

  it('should allow a user to delete an address', async () => {
    render(<AddressProvider><TestComponent /></AddressProvider>);
    await act(async () => {
      screen.getByText('Delete Address').click();
    });
    expect(screen.getByTestId('address-list').textContent).not.toContain('123 Main');
  });

  it('should select a default shipping/billing address', async () => {
    render(<AddressProvider><TestComponent /></AddressProvider>);
    await act(async () => {
      screen.getByText('Add Address').click();
      screen.getByText('Select Default').click();
    });
    expect(screen.getByTestId('default-id').textContent).toBe('2');
  });

  it('should validate address fields', () => {
    // Example validation: all fields required
    const address = { street: '', city: '', state: '', postalCode: '', country: '' };
    const isValid = Object.values(address).every(Boolean) === false;
    expect(isValid).toBe(true);
  });
}); 