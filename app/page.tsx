'use client'

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import Link from "next/link"
import Image from "next/image"
import { useCart } from "@/lib/cart"
import { useSession } from "next-auth/react"
import { ShippingIcon, QualityIcon, SecurityIcon } from '@/components/icons'
import dynamic from 'next/dynamic'
import type { Product } from '@/types/product'
import { z } from 'zod'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Dynamically import HeroSection with loading state
const HeroSection = dynamic(() => import('@/components/HeroSection'), {
  loading: () => <div className="h-96 bg-gray-100 animate-pulse" />,
  ssr: false
})

// Dynamically import heavy components with loading states
const ProductCard = dynamic(() => import('@/components/ProductCard'), {
  loading: () => (
    <div className="animate-pulse" role="status" aria-label="Loading product">
      <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
      <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
    </div>
  ),
  ssr: false
})

const NewsletterSection = dynamic(() => import('@/components/NewsletterSection'), {
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
  ssr: false
})

// Loading component for the entire page
const PageLoading = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="h-96 bg-gray-100 animate-pulse" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="h-8 w-48 bg-gray-200 rounded mb-16 mx-auto" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
            <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

// Zod schema for product validation
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stock: z.number(),
  images: z.array(z.string()),
  categoryId: z.string().nullable(),
  sku: z.string().nullable(),
  featured: z.boolean(),
  isActive: z.boolean(),
  category: z.object({ 
    id: z.string(), 
    name: z.string() 
  }).nullable(),
  weight: z.number().nullable(),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    stock: z.number(),
    type: z.string()
  })).optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
  brand: z.string().nullable().optional(),
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number()
  }).nullable().optional(),
  shipping: z.object({
    weight: z.number(),
    dimensions: z.object({
      length: z.number(),
      width: z.number(),
      height: z.number()
    }),
    freeShipping: z.boolean()
  }).nullable().optional(),
  metadata: z.record(z.string()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
const ProductArraySchema = z.array(ProductSchema);

// Cache for featured products
const CACHE_KEY = 'featured-products-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function Home() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchFeaturedProducts = useCallback(async () => {
    try {
      // Check cache first
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setFeaturedProducts(data);
          setIsLoadingProducts(false);
          return;
        }
      }

      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Use relative URL for API request
      const response = await fetch('/api/products?featured=true&limit=4', {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch featured products');
      }

      const data = await response.json();

      // Validate the response
      const responseSchema = z.object({
        products: z.array(ProductSchema),
        pagination: z.object({
          total: z.number(),
          page: z.number().optional(),
          limit: z.number(),
          totalPages: z.number().optional()
        }).optional()
      });

      const result = responseSchema.safeParse(data);
      
      if (!result.success) {
        throw new Error('Invalid products data received: schema validation failed');
      }

      // Update state and cache
      setFeaturedProducts(result.data.products);
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: result.data.products,
        timestamp: Date.now()
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore abort errors
      }
      console.error('Error fetching featured products:', error);
      setProductsError(error instanceof Error ? error.message : 'Failed to load products');
      setFeaturedProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchFeaturedProducts();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchFeaturedProducts]);

  return (
    <Suspense fallback={<PageLoading />}>
      <main className="min-h-screen bg-gray-50">
        <Suspense fallback={<div className="h-96 bg-gray-100 animate-pulse" />}>
          <HeroSection />
        </Suspense>

        {/* Featured Products Section */}
        <section className="py-20 bg-white" aria-labelledby="featured-products-heading">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="featured-products-heading" className="text-4xl font-bold text-center mb-16 text-gray-900">
              Featured Products
            </h2>
            {productsError ? (
              <div className="text-center py-8">
                <p className="text-red-600 mb-4">{productsError}</p>
                <button 
                  onClick={() => {
                    setProductsError(null);
                    setIsLoadingProducts(true);
                    fetchFeaturedProducts();
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {isLoadingProducts ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="animate-pulse" role="status" aria-label="Loading product">
                      <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
                      <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
                      <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
                    </div>
                  ))
                ) : (
                  featuredProducts.map((product) => (
                    <ErrorBoundary key={product.id} fallback={
                      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                        <p className="text-red-600">Failed to load product</p>
                      </div>
                    }>
                      <Suspense fallback={
                        <div className="animate-pulse" role="status" aria-label="Loading product">
                          <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-lg bg-gray-200" />
                          <div className="mt-4 h-4 w-3/4 rounded bg-gray-200" />
                          <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
                        </div>
                      }>
                        <ProductCard
                          product={product}
                          index={featuredProducts.indexOf(product)}
                        />
                      </Suspense>
                    </ErrorBoundary>
                  ))
                )}
              </div>
            )}
            <div className="text-center mt-12">
              <Link 
                href="/products" 
                className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-md"
                aria-label="View all products"
              >
                View All Products
              </Link>
            </div>
          </div>
        </section>

        <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
          <NewsletterSection />
        </Suspense>

        {/* Features Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-4xl font-bold text-center mb-16 text-gray-900">
            Shop with Confidence
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
            <div className="p-8 bg-white rounded-xl shadow-lg transform transition-all hover:scale-105 hover:shadow-xl">
              <ShippingIcon className="h-12 w-12 text-primary mb-6" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Fast Shipping</h3>
              <p className="text-gray-700 leading-relaxed">
                Get your orders delivered quickly and reliably to your doorstep.
              </p>
            </div>
            <div className="p-8 bg-white rounded-xl shadow-lg transform transition-all hover:scale-105 hover:shadow-xl">
              <QualityIcon className="h-12 w-12 text-primary mb-6" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Quality Products</h3>
              <p className="text-gray-700 leading-relaxed">
                We carefully select and verify all products for the highest quality.
              </p>
            </div>
            <div className="p-8 bg-white rounded-xl shadow-lg transform transition-all hover:scale-105 hover:shadow-xl">
              <SecurityIcon className="h-12 w-12 text-primary mb-6" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-900">Secure Shopping</h3>
              <p className="text-gray-700 leading-relaxed">
                Shop with confidence with our secure payment and data protection.
              </p>
            </div>
          </div>
        </section>
      </main>
    </Suspense>
  )
} 