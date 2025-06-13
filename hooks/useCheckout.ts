import { useState, useEffect } from 'react';
import { safeSessionStorage } from '@/lib/session-storage';
import { ShippingAddress, BillingAddress } from '@/types/address';

interface ShippingRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
  estimatedDays: number;
}

interface CheckoutState {
  shippingAddress: ShippingAddress | null;
  billingAddress: BillingAddress | null;
  shippingRate: ShippingRate | null;
  taxAmount: number;
  total: number;
}

export function useCheckout() {
  const [state, setState] = useState<CheckoutState>({
    shippingAddress: null,
    billingAddress: null,
    shippingRate: null,
    taxAmount: 0,
    total: 0,
  });

  useEffect(() => {
    // Load checkout data from session storage
    const loadCheckoutData = () => {
      const shippingAddress = safeSessionStorage.get('checkout.shippingAddress');
      const billingAddress = safeSessionStorage.get('checkout.billingAddress');
      const shippingRate = safeSessionStorage.get('checkout.shippingRate');
      const taxAmount = safeSessionStorage.get('checkout.taxAmount');
      const total = safeSessionStorage.get('checkout.calculatedTotal');

      setState({
        shippingAddress: shippingAddress as ShippingAddress | null,
        billingAddress: billingAddress as BillingAddress | null,
        shippingRate: shippingRate as ShippingRate | null,
        taxAmount: taxAmount as number || 0,
        total: total as number || 0,
      });
    };

    loadCheckoutData();

    // Listen for storage events to sync state across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('checkout.')) {
        loadCheckoutData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return state;
} 