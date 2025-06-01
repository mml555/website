import { useEffect, useState } from 'react';
import { Toast } from '@/components/ui/toast';

export default function AdminHome() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/dashboard/stats')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch stats');
        }
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
        setToastMessage('Analytics loaded successfully!');
        setToastType('success');
        setShowToast(true);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch stats');
        setLoading(false);
        setToastMessage(err.message || 'Failed to fetch stats');
        setToastType('error');
        setShowToast(true);
      });
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Welcome to the Admin Dashboard</h1>
      {loading ? (
        <div>Loading analytics...</div>
      ) : error ? (
        <div className="text-red-600 mb-4">{error}</div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
            <div className="text-gray-600">Total Sales</div>
          </div>
          <div className="bg-white rounded shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="text-gray-600">Total Orders</div>
          </div>
          <div className="bg-white rounded shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <div className="text-gray-600">Total Products</div>
          </div>
        </div>
      ) : null}
      {stats && stats.topProducts && (
        <div className="bg-white rounded shadow p-6 mb-8">
          <div className="font-semibold mb-2">Top 5 Products by Sales</div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-4">Product</th>
                <th className="text-left py-2 px-4">Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {stats.topProducts.map((p: any) => (
                <tr key={p.productId} className="border-t">
                  <td className="py-2 px-4">{p.name}</td>
                  <td className="py-2 px-4">{p._sum.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mb-8 text-gray-600">Use the sidebar to manage products and orders.</p>
      <div className="flex gap-4">
        <a href="/admin/products" className="px-6 py-3 bg-primary text-white rounded shadow hover:bg-primary/90 font-semibold">Manage Products</a>
        <a href="/admin/orders" className="px-6 py-3 bg-primary text-white rounded shadow hover:bg-primary/90 font-semibold">Manage Orders</a>
      </div>
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
} 