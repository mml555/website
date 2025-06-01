import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import Image from 'next/image';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    price: number;
    images?: string[];
  };
}

interface Address {
  name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  phone?: string;
}

interface Order {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  items: OrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
}

function formatPrice(price: number | undefined | null): string {
  if (typeof price !== 'number' || isNaN(price)) {
    return 'Price unavailable';
  }
  return `$${price.toFixed(2)}`;
}

async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c: any) => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/orders/${orderId}`,
      {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
        },
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function OrderDetailsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order) {
    notFound();
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Order Details</h1>
          <p className="mt-2 text-sm text-gray-700">Order #{order.id}</p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/orders"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Orders
          </Link>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Order Status</h2>
          <div className="space-y-4">
            <div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium mt-2 inline-block ${
                order.status === 'DELIVERED'
                  ? 'bg-green-100 text-green-800'
                  : order.status === 'CANCELLED'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {order.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Order Date: {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="mt-1 text-sm text-gray-900">{order.user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="mt-1 text-sm text-gray-900">{order.user.email}</p>
            </div>
          </div>
        </div>
        {order.shippingAddress && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Shipping Address</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="mt-1 text-sm text-gray-900">{order.shippingAddress.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p className="mt-1 text-sm text-gray-900">
                  {order.shippingAddress.address}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                  <br />
                  {order.shippingAddress.country}
                </p>
              </div>
              {order.shippingAddress.phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="mt-1 text-sm text-gray-900">{order.shippingAddress.phone}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {order.billingAddress && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Billing Address</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="mt-1 text-sm text-gray-900">{order.billingAddress.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Address</p>
                <p className="mt-1 text-sm text-gray-900">
                  {order.billingAddress.address}
                  <br />
                  {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.zipCode}
                  <br />
                  {order.billingAddress.country}
                </p>
              </div>
              {order.billingAddress.phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="mt-1 text-sm text-gray-900">{order.billingAddress.phone}</p>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Order Items</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Product</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Quantity</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          {item.product.images && item.product.images[0] ? (
                            <Image
                              src={item.product.images[0]}
                              alt={item.product.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">{item.product.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatPrice(item.price)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.quantity}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatPrice(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-right py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">Total</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">{formatPrice(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 