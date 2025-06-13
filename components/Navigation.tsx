"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useCart } from "@/lib/cart"
import { useState, useEffect } from "react"
import { Dialog } from "@headlessui/react"
import { Bars3Icon, XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

// TODO: Improve accessibility (keyboard navigation, focus indicators, color contrast)

const navigation = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products" },
  { name: "Categories", href: "/categories" },
  { name: "Deals", href: "/deals" },
]

export default function Navigation() {
  const pathname = usePathname()
  const { itemCount } = useCart()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery)}`)
      setSearchQuery("")
    }
  }

  const isAdmin = session?.user?.role === "ADMIN"
  const isLoggedIn = !!session

  return (
    <nav className="bg-white shadow sticky top-0 z-50" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link 
                href="/" 
                className="text-xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                aria-label="Home"
              >
                E-commerce Store
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                    pathname === item.href
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900"
                  }`}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.name}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/dashboard"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                    pathname === "/dashboard"
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-purple-600 hover:border-gray-300 hover:text-purple-700"
                  }`}
                  aria-current={pathname === "/dashboard" ? "page" : undefined}
                >
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 flex items-center justify-center px-2 lg:ml-6 lg:justify-end">
            <div className="max-w-lg w-full lg:max-w-xs">
              <form onSubmit={handleSearch} className="relative">
                <label htmlFor="search" className="sr-only">Search products</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={`block w-full pl-10 pr-3 py-2 border rounded-md leading-5 bg-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all duration-200 ${
                    isSearchFocused ? 'border-indigo-500 shadow-sm' : 'border-gray-300'
                  }`}
                  placeholder="Search products..."
                  aria-label="Search products"
                />
              </form>
            </div>
          </div>

          <div className="flex items-center">
            <Link
              href="/cart"
              className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label={`Shopping cart (${itemCount} items)`}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden ml-4">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-colors"
                onClick={() => setMobileMenuOpen(true)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label="Open main menu"
              >
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            {/* Auth buttons */}
            <div className="hidden sm:flex sm:items-center sm:ml-4">
              {!isLoggedIn && (
                <Link 
                  href="/login" 
                  className="ml-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Log in
                </Link>
              )}
              {isLoggedIn && (
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="ml-4 text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors"
                >
                  Log out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <Dialog 
        as="div" 
        className="sm:hidden" 
        open={mobileMenuOpen} 
        onClose={setMobileMenuOpen}
        aria-label="Mobile menu"
      >
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity" />
        <Dialog.Panel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 transform transition-transform duration-300 ease-in-out">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="-m-1.5 p-1.5 text-xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              E-commerce Store
            </Link>
            <button
              type="button"
              className="-m-2.5 rounded-md p-2.5 text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-500/10">
              <div className="space-y-2 py-6">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 transition-colors ${
                      pathname === item.href
                        ? "text-indigo-600 bg-indigo-50"
                        : "text-gray-900 hover:bg-gray-50"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    {item.name}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/dashboard"
                    className={`-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 transition-colors ${
                      pathname === "/dashboard"
                        ? "text-indigo-600 bg-indigo-50"
                        : "text-purple-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={pathname === "/dashboard" ? "page" : undefined}
                  >
                    Admin Dashboard
                  </Link>
                )}
              </div>
              <div className="py-6">
                {!isLoggedIn ? (
                  <Link
                    href="/login"
                    className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      signOut({ callbackUrl: '/' })
                      setMobileMenuOpen(false)
                    }}
                    className="-mx-3 block w-full text-left rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    Log out
                  </button>
                )}
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </Dialog>
    </nav>
  )
} 