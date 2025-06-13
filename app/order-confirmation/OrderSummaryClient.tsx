"use client"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import React from 'react';
import { formatOrderNumber } from '@/lib/order-utils';

export interface OrderSummaryClientProps {
  order: {
    id: string;
    orderNumber?: string;
    status: string;
    total: number;
    items: { product: { name: string; price: number }; quantity: number }[];
    shippingAddress: {
      name: string;
      email: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    createdAt?: string;
  };
}

export default function OrderSummaryClient({ order }: OrderSummaryClientProps) {
  return (
    <div className="max-w-4xl mx-auto p-6" role="main" tabIndex={-1}>
      <h1 className="text-2xl font-bold mb-8" tabIndex={-1}>Order Confirmation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Order #{order.orderNumber ? formatOrderNumber(order.orderNumber) : order.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <span className="font-semibold">Order Number:</span>
              <span className="text-lg">{order.orderNumber ? formatOrderNumber(order.orderNumber) : order.id}</span>
            </div>
            <div className="mb-4">
              <strong>Status:</strong> {order.status}
            </div>
            <div className="mb-4">
              <strong>Order Items:</strong>
              <ul className="pl-4 list-disc">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex flex-col sm:flex-row sm:justify-between">
                    <span>{item.product.name} x {item.quantity}</span>
                    <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mb-4">
              <strong>Shipping Address:</strong>
              <div className="text-sm text-gray-600">
                {order.shippingAddress.name}<br />
                {order.shippingAddress.street}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
                {order.shippingAddress.country}
              </div>
            </div>
            <div className="mb-4">
              <strong>Payment Status:</strong> {order.status === 'PAID' || order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'DELIVERED' ? 'Paid' : 'Pending'}
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between mb-2">
                <span>Subtotal:</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
              {/* Add shipping, taxes, etc. if available */}
            </div>
            <Button onClick={() => window.location.href = '/'} variant="outline" aria-label="Back to Home">Back to Home</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 