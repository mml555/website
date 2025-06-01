"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Elements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import CheckoutForm from '@/components/checkout-form';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import CheckoutDetailsForm from '../../components/checkout-details-form';
import type { CartItem } from '@/types/product';

// Type definitions

type Address = {
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

type ShippingRate = {
  name: string;
  rate: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart, total, isLoading: cartLoading } = useCart();
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();
  const { data: session, status } = useSession();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState<Address | null>(null);
  const [billingAddress, setBillingAddress] = useState<Address | null>(null);
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);

  // Parse session storage safely
  useEffect(() => {
    try {
      const storedShippingAddress = sessionStorage.getItem('shippingAddress');
      const storedBillingAddress = sessionStorage.getItem('billingAddress');
      const storedShippingRate = sessionStorage.getItem('shippingRate');
      if (!storedShippingAddress || !storedBillingAddress || !storedShippingRate) {
        router.push('/checkout/shipping');
        return;
      }
      setShippingAddress(JSON.parse(storedShippingAddress));
      setBillingAddress(JSON.parse(storedBillingAddress));
      setShippingRate(JSON.parse(storedShippingRate));
    } catch (e) {
      console.error('Invalid sessionStorage data:', e);
      router.push('/checkout/shipping');
    }
  }, [router]);

  // Add null check for addresses/rate before rendering
  if (!shippingAddress || !billingAddress || !shippingRate) {
    return null;
  }

  if (cartLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-gray-500 mb-2" />
        <div>Loading your cart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="mb-4 text-lg font-semibold">Your cart is empty.</div>
        <div className="mb-6 text-gray-500">Add some products to your cart before checking out.</div>
        <Link href="/products" className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Browse Products</Link>
      </div>
    );
  }

  // Step 1: Collect details and create order
  if (!clientSecret) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
                <CardDescription>Review your order details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {item.image && (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={200}
                            height={200}
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <p>Total</p>
                    <p>{formatPrice(total)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
                <CardDescription>Enter your shipping and billing information</CardDescription>
              </CardHeader>
              <CardContent>
                <CheckoutDetailsForm
                  items={items}
                  total={total}
                  onClientSecret={(secret: string, orderId: string) => {
                    setClientSecret(secret);
                    setOrderId(orderId);
                  }}
                  onError={(err) => setError(err.message || 'An error occurred during checkout')}
                />
                <div className="flex items-center justify-between mt-6">
                  <Link href="/cart" className="text-blue-600 hover:underline text-sm">&larr; Back to cart</Link>
                  <Button onClick={() => router.push('/products')} variant="outline" className="ml-2">Browse Products</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Payment form
  if (!items.length) {
    router.push('/cart');
    return null;
  }
  if (!clientSecret) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-gray-500 mb-2" />
        <div>Preparing payment...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>Review your order details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={200}
                          height={200}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold">
                  <p>Total</p>
                  <p>{formatPrice(total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          {/* Only render Elements if clientSecret is present */}
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <Card>
                <CardHeader>
                  <CardTitle>Payment Details</CardTitle>
                  <CardDescription>Enter your payment information</CardDescription>
                </CardHeader>
                <CardContent>
                  <CheckoutForm orderId={orderId} />
                  <div className="flex items-center justify-between mt-6">
                    <Link href="/cart" className="text-blue-600 hover:underline text-sm">&larr; Back to cart</Link>
                    <Button onClick={() => router.push('/products')} variant="outline" className="ml-2">Browse Products</Button>
                  </div>
                </CardContent>
              </Card>
            </Elements>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="animate-spin h-8 w-8 text-gray-500 mb-2" />
              <div>Preparing payment...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 