import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

async function fetchOrder(orderId: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/orders?orderId=${orderId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function OrderConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await fetchOrder(orderId);
  if (!order) return notFound();

  return (
    <div className="max-w-4xl mx-auto p-6" role="main" tabIndex={-1}>
      <h1 className="text-2xl font-bold mb-8" tabIndex={-1}>Order Confirmation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Order #{order.orderNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
              <span className="font-semibold">Order Number:</span>
              <span className="text-lg">{order.id}</span>
            </div>
            <div className="mb-4">
              <strong>Status:</strong> {order.status}
            </div>
            <div className="mb-4">
              <strong>Order Items:</strong>
              <ul className="pl-4 list-disc">
                {order.items.map((item: any, idx: number) => (
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
                {order.shippingAddress.address}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}<br />
                {order.shippingAddress.country}
              </div>
            </div>
            <div className="mb-4">
              <strong>Payment Status:</strong> {order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'DELIVERED' ? 'Paid' : 'Pending'}
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