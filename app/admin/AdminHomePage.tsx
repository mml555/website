"use client"

import { useEffect, useState } from 'react';
import { Toast } from '@/components/ui/toast';
import { Dialog } from '@headlessui/react';
import { CurrencyDollarIcon, ShoppingBagIcon, CubeIcon, CheckCircleIcon, ArrowDownTrayIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function AdminHome() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

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

  useEffect(() => {
    setAuditLoading(true);
    setAuditError(null);
    fetch('/api/admin/audit-log')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch audit log');
        }
        return res.json();
      })
      .then((data) => {
        setAuditLogs(data.logs || []);
        setAuditLoading(false);
      })
      .catch((err) => {
        setAuditError(err.message || 'Failed to fetch audit log');
        setAuditLoading(false);
      });
  }, []);

  // Import handler
  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setImportLoading(true);
    setImportError(null);
    setImportSuccess(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('importFile') as HTMLInputElement;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setImportError('Please select a file.');
      setImportLoading(false);
      return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportSuccess('Products imported successfully!');
      setToastMessage('Products imported successfully!');
      setToastType('success');
      setShowToast(true);
      setImportOpen(false);
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
      setToastMessage(err.message || 'Import failed');
      setToastType('error');
      setShowToast(true);
    } finally {
      setImportLoading(false);
    }
  };

  // Download orders report handler
  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportStart) params.append('start', reportStart);
      if (reportEnd) params.append('end', reportEnd);
      const url = `/api/admin/reports/orders${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to download report');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'orders-report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setToastMessage('Orders report downloaded!');
      setToastType('success');
      setShowToast(true);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to download report');
      setToastType('error');
      setShowToast(true);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Welcome to the Admin Dashboard</h1>
      {/* Import Products Button */}
      <div className="mb-6">
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 font-semibold"
          onClick={() => setImportOpen(true)}
        >
          Import Products (Excel)
        </button>
      </div>
      {/* Import Modal */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-md rounded bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-bold mb-4">Import Products from Excel</Dialog.Title>
            <form onSubmit={handleImport} className="flex flex-col gap-4">
              <input
                type="file"
                name="importFile"
                accept=".xlsx,.xls"
                className="border rounded px-3 py-2"
                required
              />
              {importError && <div className="text-red-600">{importError}</div>}
              {importSuccess && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  {importSuccess}
                </div>
              )}
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
                  onClick={() => setImportOpen(false)}
                  disabled={importLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                  disabled={importLoading}
                >
                  {importLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
      {/* Stats Cards with Icons and Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded shadow p-6 flex flex-col items-center animate-pulse">
              <div className="h-8 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-red-600 mb-4">{error}</div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded shadow p-6 flex flex-col items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-500 mb-2" />
            <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
            <div className="text-gray-600">Total Sales</div>
          </div>
          <div className="bg-white rounded shadow p-6 flex flex-col items-center">
            <ShoppingBagIcon className="h-8 w-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="text-gray-600">Total Orders</div>
          </div>
          <div className="bg-white rounded shadow p-6 flex flex-col items-center">
            <CubeIcon className="h-8 w-8 text-purple-500 mb-2" />
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <div className="text-gray-600">Total Products</div>
          </div>
        </div>
      ) : null}
      {/* Top Products Table with Skeleton */}
      {loading ? (
        <div className="bg-white rounded shadow p-6 mb-8 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
          <div className="h-8 w-full bg-gray-100 rounded mb-2" />
          <div className="h-8 w-full bg-gray-100 rounded mb-2" />
          <div className="h-8 w-full bg-gray-100 rounded mb-2" />
        </div>
      ) : stats && stats.topProducts ? (
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
      ) : null}
      {/* Reports Card */}
      <div className="bg-white rounded shadow p-6 mb-8 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <ArrowDownTrayIcon className="h-6 w-6 text-indigo-500" />
          <span className="font-semibold text-lg">Reports</span>
        </div>
        <p className="mb-4 text-gray-600">Download a CSV report of all orders.</p>
        <div className="flex gap-2 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="border rounded px-2 py-1" />
          </div>
        </div>
        {(reportStart || reportEnd) && (
          <div className="mb-2 text-xs text-gray-600">Range: {reportStart || '...'} to {reportEnd || '...'}</div>
        )}
        <button
          onClick={handleDownloadReport}
          className="px-4 py-2 bg-indigo-600 text-white rounded shadow hover:bg-indigo-700 font-semibold flex items-center gap-2"
          disabled={reportLoading}
        >
          {reportLoading && (
            <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          )}
          Download Orders CSV
        </button>
      </div>
      {/* Audit Log Card */}
      <div className="bg-white rounded shadow p-6 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <ClockIcon className="h-6 w-6 text-gray-500" />
          <span className="font-semibold text-lg">Audit Log</span>
        </div>
        <p className="mb-4 text-gray-600">Recent admin actions (last 20).</p>
        {auditLoading ? (
          <div className="animate-pulse">
            <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-full bg-gray-100 rounded mb-2" />
            ))}
          </div>
        ) : auditError ? (
          <div className="text-red-600">{auditError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-2 px-4">Time</th>
                  <th className="text-left py-2 px-4">User</th>
                  <th className="text-left py-2 px-4">Action</th>
                  <th className="text-left py-2 px-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-gray-400">No audit log entries found.</td></tr>
                ) : auditLogs.map((log: any) => (
                  <tr key={log.id} className="border-t">
                    <td className="py-2 px-4 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-2 px-4">{log.user?.email || log.userId}</td>
                    <td className="py-2 px-4">{log.action}</td>
                    <td className="py-2 px-4 max-w-xs truncate" title={log.details}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

// TODO: Implement advanced reporting (custom date ranges, CSV/PDF export, large dataset handling) 