'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/types/order';

interface OrderConfirmationClientProps {
  order: Order;
}

export function OrderConfirmationClient({ order }: OrderConfirmationClientProps) {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    const clearCheckoutData = async () => {
      try {
        setIsClearing(true);
        // Clear cart and other checkout-related data from session storage
        sessionStorage.removeItem('cartItems');
        sessionStorage.removeItem('shippingRate');
        sessionStorage.removeItem('billingAddress');
        sessionStorage.removeItem('shippingAddress');
        
        // Clear the order cookie
        document.cookie = 'order=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
      } catch (error) {
        console.error('Error clearing checkout data:', error);
      } finally {
        setIsClearing(false);
      }
    };

    clearCheckoutData();
  }, []);

  const handleContinueShopping = () => {
    router.push('/');
  };

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
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
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
                  <p className="font-medium">{order.id}</p>
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
                <p className="text-sm text-muted-foreground">Shipping Method</p>
                <p className="font-medium">{order.shippingMethod.name}</p>
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
                    <p className="font-medium">{item.name}</p>
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
                  <p>{formatCurrency(order.subtotal)}</p>
                </div>
                <div className="flex justify-between">
                  <p>Shipping</p>
                  <p>{formatCurrency(order.shippingMethod.price)}</p>
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
            disabled={isClearing}
            className="w-full sm:w-auto"
          >
            {isClearing ? 'Clearing Data...' : 'Continue Shopping'}
          </Button>
        </div>
      </div>
    </div>
  );
} 