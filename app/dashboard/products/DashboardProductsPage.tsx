"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from 'next/image'

interface Product {
  id: string
  name: string
  description: string
  price: number
  images: string[]
  stock: number
  categoryId: string | null
  sku: string | null
  featured: boolean
  isActive: boolean
  category: {
    name: string
    id: string
  }
}

interface Category {
  id: string
  name: string
}

interface ProductsResponse {
  products: Product[]
  totalPages: number
  currentPage: number
  totalItems: number
  total?: number
}

// TODO: Review pagination and responsive layout for edge cases and accessibility

export default function DashboardProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [limit, setLimit] = useState(25)
  const [duplicateNames, setDuplicateNames] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [sortBy, setSortBy] = useState("name_asc")

  // Fetch categories for filter dropdown
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/categories")
        if (!res.ok) return
        const data = await res.json()
        setCategories(data.categories || [])
      } catch {}
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(null)
        // Guard currentPage
        const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1
        const params = new URLSearchParams({
          page: safePage.toString(),
          limit: limit.toString(),
          ...(search && { search }),
          ...(category && { category }),
          ...(sortBy && { sortBy }),
        })
        const response = await fetch(`/api/products?${params}`)
        if (!response.ok) {
          throw new Error("Failed to fetch products")
        }
        const data: ProductsResponse & { pagination?: { total: number, page: number, limit: number, pages: number } } = await response.json()
        // Extract pagination info
        let apiTotalPages = 1, apiCurrentPage = 1, apiTotalItems = 0;
        if (data.pagination) {
          apiTotalPages = Number.isFinite(data.pagination.pages) && data.pagination.pages > 0 ? data.pagination.pages : 1;
          apiCurrentPage = Number.isFinite(data.pagination.page) && data.pagination.page > 0 ? data.pagination.page : 1;
          apiTotalItems = Number.isFinite(data.pagination.total) && data.pagination.total >= 0 ? data.pagination.total : 0;
        } else {
          apiTotalPages = Number.isFinite(data.totalPages) && data.totalPages > 0 ? data.totalPages : 1;
          apiCurrentPage = Number.isFinite(data.currentPage) && data.currentPage > 0 ? data.currentPage : 1;
          apiTotalItems = Number.isFinite(data.totalItems) && data.totalItems >= 0 ? data.totalItems : 0;
        }
        // Deduplicate by name, keep the product with the lowest price
        const nameMap = new Map<string, Product>()
        const duplicateNames = new Set<string>()
        for (const product of data.products) {
          if (nameMap.has(product.name)) {
            duplicateNames.add(product.name)
            if (product.price < nameMap.get(product.name)!.price) {
              nameMap.set(product.name, product)
            }
          } else {
            nameMap.set(product.name, product)
          }
        }
        const uniqueProducts = Array.from(nameMap.values())
        setProducts(uniqueProducts)
        setTotalPages(apiTotalPages)
        setCurrentPage(apiCurrentPage)
        setTotalItems(apiTotalItems)
        setDuplicateNames(duplicateNames)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [currentPage, search, category, sortBy, limit])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value)
    setCurrentPage(1)
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value)
    setCurrentPage(1)
  }

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Error loading products</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all products in your store.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/dashboard/products/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Add product
          </Link>
        </div>
      </div>
      {/* Filters and Sorting */}
      <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search</label>
          <input
            id="search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
          <select
            id="category"
            value={category}
            onChange={handleCategoryChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700">Sort By</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={handleSortChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900 bg-white"
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="price_asc">Price (Low to High)</option>
            <option value="price_desc">Price (High to Low)</option>
          </select>
        </div>
        <div className="flex-1 flex items-end">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Search
          </button>
        </div>
      </form>
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      Product
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Category
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Price
                    </th>
                    <th
                      scope="col"
                      className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                    >
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {products.map((product) => (
                    <tr key={product.id} className={duplicateNames.has(product.name) ? "bg-yellow-50" : ""}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <Image
                              src={product.images && product.images[0] ? product.images[0] : 'https://picsum.photos/40'}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">
                              {product.name}
                              {duplicateNames.has(product.name) && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-yellow-200 text-yellow-800 text-xs font-semibold">Duplicate</span>
                              )}
                            </div>
                            <div className="text-gray-500">
                              {product.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {product.category && product.category.name ? product.category.name : 'Uncategorized'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        ${product.price.toFixed(2)}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || !Number.isFinite(currentPage)}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.min(Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1, prev + 1))}
            disabled={currentPage === totalPages || !Number.isFinite(currentPage) || !Number.isFinite(totalPages)}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{!isNaN((currentPage - 1) * limit + 1) ? (currentPage - 1) * limit + 1 : ''}</span> to{" "}
              <span className="font-medium">{!isNaN(Math.min(currentPage * limit, totalItems)) ? Math.min(currentPage * limit, totalItems) : ''}</span>{" "}
              of <span className="font-medium">{!isNaN(totalItems) ? totalItems : ''}</span> results
            </p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || !Number.isFinite(currentPage)}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              {Array.from({ length: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1 }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    page === currentPage
                      ? "z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1, prev + 1))}
                disabled={currentPage === totalPages || !Number.isFinite(currentPage) || !Number.isFinite(totalPages)}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
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
      </div>
    </div>
  )
} 