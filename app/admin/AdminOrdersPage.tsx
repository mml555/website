"use client"

import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { StatusBadge } from '@/components/ui/StatusBadge';

// TODO: Implement admin saved filters (save/load filter configs, persist across sessions)

const ORDER_STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  ...ORDER_STATUSES.map(s => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: s })),
];

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  user: { email: string } | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  function fetchOrders() {
    setLoading(true);
    setError(null);
    fetch('/api/admin/orders')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setError('You are not authorized to view orders.');
          } else {
            setError(data.error || 'Failed to fetch orders');
          }
          setOrders([]);
        } else {
          setOrders(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch orders');
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailOrder(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch order');
      }
      setDetailOrder(await res.json());
    } catch (err: any) {
      setDetailError(err.message || 'Failed to fetch order');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!detailOrder) return;
    setStatusLoading(true);
    setStatusError(null);
    const newStatus = e.target.value;
    const res = await fetch(`/api/orders/${detailOrder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const data = await res.json();
      setStatusError(data.error || 'Failed to update status');
      setStatusLoading(false);
      return;
    }
    const updated = await res.json();
    setDetailOrder((prev: any) => ({ ...prev, status: updated.status }));
    setStatusLoading(false);
    fetchOrders();
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesSearch = o.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Order Management</h1>
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <input
          type="text"
          placeholder="Search order #..."
          className="border rounded px-3 py-2 w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div>Loading orders...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : filteredOrders.length === 0 ? (
        <div>No orders found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-4">Order #</th>
                <th className="text-left py-2 px-4">User</th>
                <th className="text-left py-2 px-4">Date</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Total</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className="border-t">
                  <td className="py-2 px-4 font-mono">{order.orderNumber}</td>
                  <td className="py-2 px-4">{order.user?.email || 'Guest'}</td>
                  <td className="py-2 px-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 px-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-2 px-4">${order.total.toFixed(2)}</td>
                  <td className="py-2 px-4">
                    <button
                      className="text-primary underline mr-2"
                      onClick={() => openDetail(order.id)}
                    >
                      View
                    </button>
                    <button className="text-primary underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail Modal */}
      <Dialog open={!!detailId} onClose={() => setDetailId(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-2xl rounded bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-bold mb-4">Order Details</Dialog.Title>
            {detailLoading ? (
              <div>Loading...</div>
            ) : detailError ? (
              <div className="text-red-600">{detailError}</div>
            ) : detailOrder ? (
              <div>
                <div className="mb-4">
                  <div className="font-semibold">Order #:</div>
                  <div className="mb-2 font-mono">{detailOrder.orderNumber}</div>
                  <div className="font-semibold">User:</div>
                  <div className="mb-2">{detailOrder.user?.email || 'Guest'}</div>
                  <div className="font-semibold">Status:</div>
                  <div className="mb-2 flex items-center gap-2">
                    <select
                      className="border rounded px-2 py-1"
                      value={detailOrder.status}
                      onChange={handleStatusChange}
                      disabled={statusLoading}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {statusLoading && <span className="text-xs text-gray-500">Saving...</span>}
                  </div>
                  {statusError && <div className="text-red-600 mb-2">{statusError}</div>}
                  <div className="font-semibold">Payment Status:</div>
                  <div className="mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                      detailOrder.paymentIntentId && ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(detailOrder.status)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {detailOrder.paymentIntentId && ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(detailOrder.status)
                        ? 'Paid'
                        : 'Pending'}
                    </span>
                    {detailOrder.paymentIntentId && (
                      <p className="mt-1 text-xs text-gray-500">
                        Payment ID: {detailOrder.paymentIntentId}
                      </p>
                    )}
                  </div>
                  <div className="font-semibold">Total:</div>
                  <div className="mb-2">${detailOrder.total.toFixed(2)}</div>
                  <div className="font-semibold">Created:</div>
                  <div className="mb-2">{new Date(detailOrder.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-semibold mb-2">Items:</div>
                  <table className="min-w-full text-sm border mb-4">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left py-2 px-4">Image</th>
                        <th className="text-left py-2 px-4">Product</th>
                        <th className="text-left py-2 px-4">Variant</th>
                        <th className="text-left py-2 px-4">Qty</th>
                        <th className="text-left py-2 px-4">Price</th>
                        <th className="text-left py-2 px-4">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.items.map((item: any) => (
                        <tr key={item.id} className="border-t">
                          <td className="py-2 px-4">
                            {item.product?.images && item.product.images[0] ? (
                              <img
                                src={item.product.images[0]}
                                alt={item.product.name}
                                className="h-10 w-10 rounded object-cover border"
                                style={{ minWidth: 40, minHeight: 40 }}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center text-gray-400">N/A</div>
                            )}
                          </td>
                          <td className="py-2 px-4">{item.product?.name || 'Deleted'}</td>
                          <td className="py-2 px-4">{item.variant?.name || '-'}</td>
                          <td className="py-2 px-4">{item.quantity}</td>
                          <td className="py-2 px-4">${item.price.toFixed(2)}</td>
                          <td className="py-2 px-4">${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
                onClick={() => setDetailId(null)}
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
} 