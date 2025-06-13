'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/types/order';
import { useCart } from '@/lib/cart';
import { logger } from '@/lib/logger';
import { useSession } from 'next-auth/react';

interface OrderConfirmationClientProps {
  initialOrder?: Order;
}

export function OrderConfirmationClient({ initialOrder }: OrderConfirmationClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(initialOrder || null);
  const [cartCleared, setCartCleared] = useState(false);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const paymentIntentId = searchParams.get('payment_intent');
        const orderId = searchParams.get('orderId');

        // If we have an initial order, use it and clean up the URL
        if (initialOrder) {
          setOrder(initialOrder);
          // Clean up URL by removing all query parameters
          if (window.location.search) {
            router.replace(`/order-confirmation/${initialOrder.id}`);
          }
          setLoading(false);
          return;
        }

        if (!paymentIntentId && !orderId) {
          throw new Error('No order identifier provided');
        }

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add guest session if available
        const guestSession = sessionStorage.getItem('guestSession');
        if (guestSession) {
          headers['X-Guest-Session'] = guestSession;
        }

        logger.info('Fetching order details:', {
          paymentIntentId,
          orderId,
          hasSession: !!session,
          hasGuestSession: !!guestSession
        });

        const response = await fetch(
          `/api/orders?${orderId ? `orderId=${orderId}` : `payment_intent=${paymentIntentId}`}`,
          {
            method: 'GET',
            headers,
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch order details');
        }

        const data = await response.json();

        if (!data.orders || !Array.isArray(data.orders) || data.orders.length === 0) {
          throw new Error('No order found');
        }

        const fetchedOrder = data.orders[0];
        setOrder(fetchedOrder);

        // Clean up URL by removing all query parameters
        if (window.location.search) {
          router.replace(`/order-confirmation/${fetchedOrder.id}`);
        }

        // Clear cart if not already cleared
        if (!cartCleared) {
          try {
            // Clear cart state
            clearCart();
            
            // Clear guest session if it exists
            if (guestSession) {
              sessionStorage.removeItem('guestSession');
            }
            
            // Clear cart from localStorage
            localStorage.removeItem('cart');
            localStorage.removeItem('guestCart');
            localStorage.removeItem('cartState');
            
            setCartCleared(true);
            logger.info('Cart cleared successfully');
          } catch (err) {
            logger.error('Error clearing cart:', err);
          }
        }
      } catch (err) {
        logger.error('Error fetching order:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [searchParams, clearCart, cartCleared, router, session, initialOrder]);

  const handleContinueShopping = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Loading...</h1>
          <p className="text-muted-foreground mb-8">
            Please wait while we fetch your order details.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-8">
            {error}
          </p>
          <Button onClick={handleContinueShopping}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Order Not Found</h1>
          <p className="text-muted-foreground mb-8">
            We couldn't find the order you're looking for.
          </p>
          <Button onClick={handleContinueShopping}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. Your order has been received.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-medium">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(order.createdAt), 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline">{order.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-medium">{formatCurrency(order.total)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Shipping Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Shipping Address</p>
                <p className="font-medium">
                  {order.shippingAddress.street}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                  <br />
                  {order.shippingAddress.country}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Shipping Rate</p>
                <p className="font-medium">{formatCurrency(order.shippingRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-md" />
                  <div className="flex-1">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.price)}</p>
                </div>
              ))}
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <p>Subtotal</p>
                  <p>{formatCurrency(order.total - order.tax - order.shippingRate)}</p>
                </div>
                <div className="flex justify-between">
                  <p>Shipping</p>
                  <p>{formatCurrency(order.shippingRate)}</p>
                </div>
                <div className="flex justify-between">
                  <p>Tax</p>
                  <p>{formatCurrency(order.tax)}</p>
                </div>
                <div className="flex justify-between font-bold">
                  <p>Total</p>
                  <p>{formatCurrency(order.total)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            onClick={handleContinueShopping}
            className="w-full sm:w-auto"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
} 