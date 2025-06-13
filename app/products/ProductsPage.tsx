"use client"

// TODO: Improve search & filtering (fuzzy search, autocomplete, attribute filtering, search analytics)

export const dynamic = 'force-dynamic'

import { useEffect, useState, Fragment } from "react"
import { useCart } from "@/lib/cart"
import { useSearchParams, useRouter } from "next/navigation"
import type { Product as ProductType } from "@/types/product"
import ProductCard from '@/components/ProductCard'
import { z } from 'zod'

interface Category {
  id: string
  name: string
  description?: string
}

// Helper function to convert any numeric type to number
const toNumber = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val);
  if (val && typeof val === 'object' && 'toNumber' in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return 0;
};

// Zod schemas
const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
const CategoryArraySchema = z.array(CategorySchema);
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.any().transform(toNumber),
  stock: z.any().transform(toNumber),
  images: z.array(z.string()).default([]),
  categoryId: z.string().nullable(),
  sku: z.string().nullable(),
  featured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  category: z.object({ 
    id: z.string(), 
    name: z.string() 
  }).nullable(),
  weight: z.any().transform(toNumber).nullable(),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.any().transform(toNumber),
    stock: z.any().transform(toNumber),
    type: z.string().optional()
  })).optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  brand: z.string().optional(),
  dimensions: z.object({
    length: z.any().transform(toNumber),
    width: z.any().transform(toNumber),
    height: z.any().transform(toNumber)
  }).optional(),
  shipping: z.object({
    weight: z.any().transform(toNumber),
    dimensions: z.object({
      length: z.any().transform(toNumber),
      width: z.any().transform(toNumber),
      height: z.any().transform(toNumber)
    }),
    freeShipping: z.boolean().default(false)
  }).optional(),
  metadata: z.record(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
}).passthrough(); // Allow additional properties
const ProductArraySchema = z.array(ProductSchema);

export default function StorefrontProductsPage() {
  const [products, setProducts] = useState<ProductType[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [updatingQuantity, setUpdatingQuantity] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [priceRange, setPriceRange] = useState({ min: "", max: "" })
  const [sortBy, setSortBy] = useState("stock_desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [stockFilter, setStockFilter] = useState("all") // "all", "in_stock", "out_of_stock"
  const [hideOutOfStock, setHideOutOfStock] = useState(false)
  const { addItem } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const response = await fetch("/api/categories")
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Failed to fetch categories: ${response.status}`)
        }
        const data = await response.json()
        
        // Validate categories data
        if (!data.categories || !Array.isArray(data.categories)) {
          console.error("Invalid data structure:", {
            hasCategories: !!data.categories,
            isArray: Array.isArray(data.categories),
            dataType: typeof data.categories,
            data: data
          })
          throw new Error("Invalid categories data received: expected an array")
        }

        // Zod validation
        const parseResult = CategoryArraySchema.safeParse(data.categories)
        if (!parseResult.success) {
          console.error('Zod validation error details:', {
            errors: parseResult.error.errors,
            receivedData: data.categories
          })
          throw new Error('Invalid categories data received: schema validation failed')
        }
        const validCategories = parseResult.data
        setCategories(validCategories)
      } catch (err) {
        console.error("Error fetching categories:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch categories")
      } finally {
        setIsLoadingCategories(false)
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoadingProducts(true)
        setError(null)
        
        const queryParams = new URLSearchParams({
          page: currentPage.toString(),
          search: searchQuery,
          category: selectedCategory,
          minPrice: priceRange.min,
          maxPrice: priceRange.max,
          sortBy,
          stockFilter: hideOutOfStock ? "in_stock" : stockFilter,
        })

        const response = await fetch(`/api/products?${queryParams}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `Failed to fetch products: ${response.status}`)
        }
        const data = await response.json()
        
        // Validate products data
        if (!data.products || !Array.isArray(data.products)) {
          console.error("Invalid data structure:", {
            hasProducts: !!data.products,
            isArray: Array.isArray(data.products),
            dataType: typeof data.products,
            data: data
          })
          throw new Error("Invalid products data received: expected an array")
        }

        // Safeguard for pagination/total
        if (!data.pagination || typeof data.pagination.total !== "number" || typeof data.pagination.limit !== "number") {
          console.error("Invalid pagination structure:", data.pagination)
          throw new Error("Invalid response format: missing pagination/total/limit")
        }

        // Zod validation
        const parseResult = ProductArraySchema.safeParse(data.products)
        if (!parseResult.success) {
          console.error('Zod validation error details:', {
            errors: parseResult.error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
              code: err.code
            })),
            sampleProduct: data.products[0] ? {
              id: data.products[0].id,
              name: data.products[0].name,
              description: data.products[0].description,
              price: data.products[0].price,
              stock: data.products[0].stock,
              images: data.products[0].images,
              categoryId: data.products[0].categoryId,
              sku: data.products[0].sku,
              featured: data.products[0].featured,
              isActive: data.products[0].isActive,
              category: data.products[0].category,
              weight: data.products[0].weight,
              variants: data.products[0].variants,
              tags: data.products[0].tags,
              rating: data.products[0].rating,
              reviews: data.products[0].reviews,
              brand: data.products[0].brand,
              dimensions: data.products[0].dimensions,
              shipping: data.products[0].shipping,
              metadata: data.products[0].metadata,
              createdAt: data.products[0].createdAt,
              updatedAt: data.products[0].updatedAt
            } : null
          })
          throw new Error('Invalid products data received: schema validation failed')
        }
        // Ensure all variants have a type property
        const validProducts = parseResult.data.map((product: any) => ({
          ...product,
          variants: product.variants?.map((variant: any) => ({
            ...variant,
            type: variant.type || ""
          })) || []
        }))
        setProducts(validProducts)
        
        // Initialize quantities for all products
        const initialQuantities = validProducts.reduce((acc: Record<string, number>, product: ProductType) => ({
          ...acc,
          [product.id]: 1
        }), {})
        setQuantities(initialQuantities)
        setTotalPages(Math.ceil(data.pagination.total / data.pagination.limit) || 1)
      } catch (err) {
        console.error("Error fetching products:", err)
        setError(err instanceof Error ? err.message : "An error occurred while fetching products")
        setProducts([])
      } finally {
        setIsLoadingProducts(false)
      }
    }

    fetchProducts()
  }, [currentPage, searchQuery, selectedCategory, priceRange, sortBy, stockFilter, hideOutOfStock])

  const handleQuantityChange = async (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    try {
      setUpdatingQuantity(productId)
      const validQuantity = Math.max(1, Math.min(newQuantity, product.stock ?? Infinity))
      setQuantities(prev => ({
        ...prev,
        [productId]: validQuantity
      }))
    } finally {
      setUpdatingQuantity(null)
    }
  }

  const handleAddToCart = async (product: ProductType) => {
    try {
      setAddingToCart(product.id)
      setError(null)

      const price = validatePrice(product.price)
      const quantity = quantities[product.id] || 1
      if (quantity > (product.stock ?? Infinity)) {
        throw new Error("Not enough stock available")
      }

      await addItem({
        productId: product.id,
        quantity,
        price,
        originalPrice: price, // Set original price to initial price
        product: {
          id: product.id,
          name: product.name,
          price,
          images: product.images,
          stock: product.stock
        }
      })
      setToast(`${product.name} added to cart!`)
      setTimeout(() => setToast(null), 2500)

      // Show success feedback
      const button = document.getElementById(`add-to-cart-${product.id}`)
      if (button) {
        button.textContent = "Added!"
        setTimeout(() => {
          if (button) {
            button.textContent = product.stock === 0 ? "Out of Stock" : "Add to Cart"
          }
        }, 2000)
      }
    } catch (err) {
      console.error("Error adding to cart:", err)
      setError(err instanceof Error ? err.message : "Failed to add item to cart")
    } finally {
      setAddingToCart(null)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
  }

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Fragment>
      {toast && (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24 lg:max-w-7xl lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Our Products
            </h1>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 active:bg-primary/80"
            >
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
          </div>

          {/* Search and Filters */}
          <div className={`mb-8 space-y-4 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <form onSubmit={handleSearch} className="flex gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, description, or SKU..."
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                aria-label="Search products"
              />
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 active:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Search
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  handleFilterChange()
                }}
                disabled={isLoadingCategories}
                className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPriceRange(prev => ({ ...prev, min: val }));
                    handleFilterChange();
                  }}
                  placeholder="Min price"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  aria-label="Minimum price"
                />
                <input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPriceRange(prev => ({ ...prev, max: val }));
                    handleFilterChange();
                  }}
                  placeholder="Max price"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                  aria-label="Maximum price"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  handleFilterChange()
                }}
                className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary font-semibold text-gray-900"
                aria-label="Sort products"
              >
                <option value="stock_desc">Sort by Stock: High to Low (Default)</option>
                <option value="stock_asc">Sort by Stock: Low to High</option>
                <option value="name">Sort by Name</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="hide-out-of-stock"
                checked={hideOutOfStock}
                onChange={() => {
                  setHideOutOfStock(v => !v)
                  handleFilterChange()
                }}
                className="rounded border-gray-300 text-primary focus:ring-primary scale-125"
                aria-label="Hide out of stock products"
              />
              <label htmlFor="hide-out-of-stock" className="text-base text-gray-700 select-none font-medium">
                Hide out-of-stock products
              </label>
            </div>
          </div>

          {/* Products Grid */}
          {isLoadingProducts ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : !products || products.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-lg font-medium text-gray-900">No products found</h2>
              <p className="mt-2 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-8">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:bg-gray-100"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      currentPage === page
                        ? "z-10 bg-primary text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                    }`}
                  >
                    {Number.isNaN(Number(page)) ? '' : page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:bg-gray-100"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </Fragment>
  )
} 