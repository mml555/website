import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@headlessui/react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Toast } from '@/components/ui/toast';

const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  salePrice?: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  categoryId?: string;
  images?: string[];
}

interface Category { id: string; name: string; }

const DEFAULT_LIMIT = 25;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    price: '',
    cost: '',
    salePrice: '',
    stock: '',
    isActive: true,
    categoryId: '',
    image: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);
  const [jumpPage, setJumpPage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  function fetchProducts(pageNum = page, limitNum = limit, searchVal = search, statusVal = statusFilter) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(limitNum),
      search: searchVal,
      status: statusVal,
    });
    fetch(`/api/admin/products?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch products');
        }
        return res.json();
      })
      .then((data) => {
        setProducts(data.products);
        setTotal(data.totalItems);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch products');
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchProducts(page, limit, search, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || []);
        setCategoriesLoading(false);
      })
      .catch(err => {
        setCategoriesError('Failed to load categories');
        setCategoriesLoading(false);
      });
  }, []);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let checked = false;
    if ('checked' in e.target && typeof (e.target as HTMLInputElement).checked === 'boolean') {
      checked = (e.target as HTMLInputElement).checked;
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openCreateModal = () => {
    setEditId(null);
    setForm({ name: '', sku: '', price: '', cost: '', salePrice: '', stock: '', isActive: true, categoryId: '', image: '' });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditId(product.id);
    setForm({
      name: product.name,
      sku: product.sku || '',
      price: product.price?.toString() || '',
      cost: product.cost?.toString() || '',
      salePrice: product.salePrice?.toString() || '',
      stock: product.stock?.toString() || '',
      isActive: product.isActive,
      categoryId: product.categoryId || '',
      image: (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : ''),
    });
    setModalOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeleteId(id);
    setDeleteError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      price: Number(form.price),
      cost: form.cost ? Number(form.cost) : undefined,
      salePrice: form.salePrice ? Number(form.salePrice) : undefined,
      stock: Number(form.stock),
      isActive: form.isActive,
      categoryId: form.categoryId,
      image: form.image,
    };
    if (!payload.name || isNaN(payload.price) || isNaN(payload.stock)) {
      setFormError('All fields are required.');
      setFormLoading(false);
      return;
    }
    let res;
    if (editId) {
      res = await fetch(`/api/admin/products/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || 'Failed to save product');
      setFormLoading(false);
      return;
    }
    setModalOpen(false);
    setForm({ name: '', sku: '', price: '', cost: '', salePrice: '', stock: '', isActive: true, categoryId: '', image: '' });
    setEditId(null);
    fetchProducts();
    setFormLoading(false);
    setToastMessage(editId ? 'Product updated successfully' : 'Product created successfully');
    setToastType('success');
    setShowToast(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/products/${deleteId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      try {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete product');
      } catch {
        setDeleteError('Failed to delete product');
      }
      setDeleteLoading(false);
      return;
    }
    setDeleteId(null);
    setDeleteLoading(false);
    fetchProducts();
    setToastMessage('Product deleted successfully');
    setToastType('success');
    setShowToast(true);
  };

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(jumpPage);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      setPage(num);
      setJumpPage('');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Product Management</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 font-semibold"
          onClick={openCreateModal}
        >
          + Create Product
        </button>
      </div>
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <input
          type="text"
          placeholder="Search products..."
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
        <div>Loading products...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="flex flex-col items-center justify-center">
            <svg className="w-10 h-10 mb-2 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h3m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            <span>No products found.</span>
          </div>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-2 px-4">Image</th>
                <th className="text-left py-2 px-4">Name</th>
                <th className="text-left py-2 px-4">SKU</th>
                <th className="text-left py-2 px-4">Stock</th>
                <th className="text-left py-2 px-4">Cost</th>
                <th className="text-left py-2 px-4">Price</th>
                <th className="text-left py-2 px-4">Sale Price</th>
                <th className="text-left py-2 px-4">Margin %</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="py-2 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(limit)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-2 px-4 bg-gray-100" colSpan={10}>&nbsp;</td>
                  </tr>
                ))
              ) : (
                products.map(product => {
                  const margin = product.cost && product.price ? ((product.price - product.cost) / product.price) * 100 : null;
                  return (
                    <tr key={product.id} className="border-t">
                      <td className="py-2 px-4">
                        <img src={product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/40'} alt={product.name} className="h-10 w-10 rounded object-cover" />
                      </td>
                      <td className="py-2 px-4 font-medium">{product.name}</td>
                      <td className="py-2 px-4">{product.sku || '-'}</td>
                      <td className="py-2 px-4">{product.stock}</td>
                      <td className="py-2 px-4">{typeof product.cost === 'number' ? `$${product.cost.toFixed(2)}` : '-'}</td>
                      <td className="py-2 px-4">${product.price.toFixed(2)}</td>
                      <td className="py-2 px-4">{typeof product.salePrice === 'number' ? `$${product.salePrice.toFixed(2)}` : '-'}</td>
                      <td className="py-2 px-4">{margin !== null ? `${margin.toFixed(1)}%` : '-'}</td>
                      <td className="py-2 px-4">
                        <StatusBadge status={product.isActive ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td className="py-2 px-4">
                        <button
                          className="text-primary underline mr-2"
                          onClick={() => openEditModal(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => openDeleteDialog(product.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4">
          {total > 0 ? (
            <div>
              Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} results
            </div>
          ) : (
            <div>No products found.</div>
          )}
          <div className="flex gap-2 items-center">
            <button
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage(page - 1)}
              disabled={!canPrev}
            >
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <form onSubmit={handleJumpPage} className="inline-flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={e => setJumpPage(e.target.value)}
                className="w-14 px-2 py-1 border rounded"
                placeholder="Go to"
              />
              <button type="submit" className="px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200">Go</button>
            </form>
            <button
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage(page + 1)}
              disabled={!canNext}
            >
              Next
            </button>
            <select
              className="ml-2 border rounded px-2 py-1"
              value={limit}
              onChange={handleLimitChange}
            >
              {[10, 25, 50, 100].map(opt => (
                <option key={opt} value={opt}>{opt} / page</option>
              ))}
            </select>
          </div>
        </div>
        </>
      )}

      {/* Create/Edit Product Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-md rounded bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-bold mb-4">
              {editId ? 'Edit Product' : 'Create Product'}
            </Dialog.Title>
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="name" className="block font-semibold mb-1">Name</label>
                <input
                  id="name"
                  name="name"
                  className="w-full border rounded px-3 py-2"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="sku" className="block font-semibold mb-1">SKU</label>
                <input
                  id="sku"
                  name="sku"
                  className="w-full border rounded px-3 py-2"
                  value={form.sku}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label htmlFor="price" className="block font-semibold mb-1">Price</label>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                  value={form.price}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="cost" className="block font-semibold mb-1">Cost</label>
                <input
                  id="cost"
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                  value={form.cost}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label htmlFor="salePrice" className="block font-semibold mb-1">Sale Price</label>
                <input
                  id="salePrice"
                  name="salePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                  value={form.salePrice}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label htmlFor="stock" className="block font-semibold mb-1">Stock</label>
                <input
                  id="stock"
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  className="w-full border rounded px-3 py-2"
                  value={form.stock}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="image" className="block font-semibold mb-1">Image URL</label>
                <input
                  id="image"
                  name="image"
                  type="url"
                  className="w-full border rounded px-3 py-2"
                  value={form.image}
                  onChange={handleFormChange}
                />
                {form.image && (
                  <img src={form.image} alt="Preview" className="h-16 w-16 mt-2 rounded object-cover border" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  name="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={handleFormChange}
                />
                <label htmlFor="isActive" className="font-medium">Active</label>
              </div>
              {/* Margin % (read-only) */}
              <div>
                <label className="block font-semibold mb-1">Margin %</label>
                <div className="border rounded px-3 py-2 bg-gray-50">
                  {form.price && form.cost && !isNaN(Number(form.price)) && !isNaN(Number(form.cost))
                    ? `${(((Number(form.price) - Number(form.cost)) / Number(form.price)) * 100).toFixed(1)}%`
                    : '-'}
                </div>
              </div>
              {formError && <div className="text-red-600">{formError}</div>}
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
                  onClick={() => setModalOpen(false)}
                  disabled={formLoading || categoriesLoading || !form.categoryId}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-primary text-white font-semibold hover:bg-primary/90"
                  disabled={formLoading || categoriesLoading || !form.categoryId}
                >
                  {formLoading ? (editId ? 'Saving...' : 'Creating...') : (editId ? 'Save' : 'Create')}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-sm rounded bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-bold mb-4">Delete Product</Dialog.Title>
            <p className="mb-4">Are you sure you want to delete this product? This action cannot be undone.</p>
            {deleteError && <div className="text-red-600 mb-2">{deleteError}</div>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
                onClick={() => setDeleteId(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Error Notification */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded shadow z-50">
          {error}
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
      )}
    </div>
  );
} 