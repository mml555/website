import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

interface Address {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface BillingAddress {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number;
  shippingAddress: Address;
  billingAddress: BillingAddress;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  error: string | null;
  createOrder: (orderData: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  fetchOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  const createOrder = useCallback(async (orderData: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response || typeof response !== 'object' || !('ok' in response)) {
        throw new Error('Failed to create order');
      }
      if (!response.ok) {
        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = {};
        }
        throw new Error((data && (data.message || data.error)) || 'Failed to create order');
      }

      const newOrder = await response.json();
      setOrders((prev) => [...prev, newOrder]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response || typeof response !== 'object' || !('ok' in response)) {
        throw new Error('Failed to fetch orders');
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [session]);

  const updateOrderStatus = useCallback(async (orderId: string, status: Order['status']) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response || typeof response !== 'object' || !('ok' in response)) {
        throw new Error('Failed to update order status');
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to update order status');
      }

      const updatedOrder = await response.json();
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? updatedOrder : order))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <OrderContext.Provider
      value={{
        orders,
        loading,
        error,
        createOrder,
        fetchOrders,
        updateOrderStatus,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
} 