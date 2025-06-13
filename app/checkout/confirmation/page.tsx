"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product?: {
    name: string;
    images: string[];
  };
  variant?: {
    name: string;
  };
}

interface Address {
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
  status: string;
  total: number;
  tax?: number;
  shippingRate?: number;
  customerEmail?: string;
  paymentIntentId?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  items: OrderItem[];
}

export default function CheckoutConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentIntentId = searchParams.get('payment_intent');
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
    const redirectStatus = searchParams.get('redirect_status');
    const orderId = searchParams.get('order_id');

    if (paymentIntentId) {
      // Redirect to the order-confirmation page with the same parameters
      const params = new URLSearchParams();
      params.set('payment_intent', paymentIntentId);
      if (paymentIntentClientSecret) {
        params.set('payment_intent_client_secret', paymentIntentClientSecret);
      }
      if (redirectStatus) {
        params.set('redirect_status', redirectStatus);
      }
      if (orderId) {
        params.set('order_id', orderId);
      }
      
      router.replace(`/order-confirmation?${params.toString()}`);
    }
  }, [router, searchParams]);

  return null; // This page will redirect immediately
} 