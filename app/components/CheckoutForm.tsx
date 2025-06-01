"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js"
import Link from 'next/link'

interface Address {
  name: string
  email: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
  phone: string
}

interface CheckoutFormProps {
  clientSecret: string
  items: Array<{
    id: string
    quantity: number
    price: number
  }>
}

export default function CheckoutForm({ clientSecret, items }: CheckoutFormProps) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [shippingAddress, setShippingAddress] = useState<Address>({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
  })
  const [billingAddress, setBillingAddress] = useState<Address>({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    phone: "",
  })

  const handleAddressChange = (
    type: "shipping" | "billing",
    field: keyof Address,
    value: string
  ) => {
    if (type === "shipping") {
      setShippingAddress((prev) => ({ ...prev, [field]: value }))
      if (sameAsShipping) {
        setBillingAddress((prev) => ({ ...prev, [field]: value }))
      }
    } else {
      setBillingAddress((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      // Validate shipping address
      const requiredFields: (keyof Address)[] = ["name", "email", "address", "city", "state", "zipCode"]
      const missingShippingFields = requiredFields.filter(field => !shippingAddress[field])
      if (missingShippingFields.length > 0) {
        throw new Error(`Please fill in all required shipping address fields: ${missingShippingFields.join(", ")}`)
      }

      // Validate billing address if not same as shipping
      if (!sameAsShipping) {
        const missingBillingFields = requiredFields.filter(field => !billingAddress[field])
        if (missingBillingFields.length > 0) {
          throw new Error(`Please fill in all required billing address fields: ${missingBillingFields.join(", ")}`)
        }
      }

      // Create order first
      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items,
          shippingAddress: shippingAddress,
          billingAddress: sameAsShipping ? shippingAddress : billingAddress,
        }),
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json()
        throw new Error(errorData.message || "Failed to create order")
      }

      const orderData = await orderResponse.json()

      // Then confirm payment
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
          payment_method_data: {
            billing_details: {
              name: billingAddress.name,
              email: billingAddress.email,
              phone: billingAddress.phone,
              address: {
                line1: billingAddress.address,
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.zipCode,
                country: billingAddress.country,
              },
            },
          },
        },
      })

      if (submitError) {
        setError(submitError.message || "An error occurred")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <div className="space-y-8">
        {/* Shipping Address */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Shipping Address</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="shipping-name" className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                id="shipping-name"
                name="shipping-name"
                type="text"
                value={shippingAddress.name}
                onChange={(e) => handleAddressChange("shipping", "name", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="shipping-email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="shipping-email"
                name="shipping-email"
                type="email"
                value={shippingAddress.email}
                onChange={(e) => handleAddressChange("shipping", "email", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="shipping-address" className="block text-sm font-medium text-gray-700">Address</label>
              <input
                id="shipping-address"
                name="shipping-address"
                type="text"
                value={shippingAddress.address}
                onChange={(e) => handleAddressChange("shipping", "address", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="shipping-city" className="block text-sm font-medium text-gray-700">City</label>
              <input
                id="shipping-city"
                name="shipping-city"
                type="text"
                value={shippingAddress.city}
                onChange={(e) => handleAddressChange("shipping", "city", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="shipping-state" className="block text-sm font-medium text-gray-700">State</label>
              <input
                id="shipping-state"
                name="shipping-state"
                type="text"
                value={shippingAddress.state}
                onChange={(e) => handleAddressChange("shipping", "state", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="shipping-zip" className="block text-sm font-medium text-gray-700">ZIP Code</label>
              <input
                id="shipping-zip"
                name="shipping-zip"
                type="text"
                value={shippingAddress.zipCode}
                onChange={(e) => handleAddressChange("shipping", "zipCode", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="shipping-country" className="block text-sm font-medium text-gray-700">Country</label>
              <input
                id="shipping-country"
                name="shipping-country"
                type="text"
                value={shippingAddress.country}
                onChange={(e) => handleAddressChange("shipping", "country", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={shippingAddress.phone}
                onChange={(e) => handleAddressChange("shipping", "phone", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Billing Address</h2>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={sameAsShipping}
                onChange={(e) => setSameAsShipping(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600">Same as shipping address</span>
            </label>
          </div>
          {!sameAsShipping && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="billing-name" className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  id="billing-name"
                  name="billing-name"
                  type="text"
                  value={billingAddress.name}
                  onChange={(e) => handleAddressChange("billing", "name", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="billing-email"
                  name="billing-email"
                  type="email"
                  value={billingAddress.email}
                  onChange={(e) => handleAddressChange("billing", "email", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="billing-address" className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  id="billing-address"
                  name="billing-address"
                  type="text"
                  value={billingAddress.address}
                  onChange={(e) => handleAddressChange("billing", "address", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-city" className="block text-sm font-medium text-gray-700">City</label>
                <input
                  id="billing-city"
                  name="billing-city"
                  type="text"
                  value={billingAddress.city}
                  onChange={(e) => handleAddressChange("billing", "city", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-state" className="block text-sm font-medium text-gray-700">State</label>
                <input
                  id="billing-state"
                  name="billing-state"
                  type="text"
                  value={billingAddress.state}
                  onChange={(e) => handleAddressChange("billing", "state", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-zip" className="block text-sm font-medium text-gray-700">ZIP Code</label>
                <input
                  id="billing-zip"
                  name="billing-zip"
                  type="text"
                  value={billingAddress.zipCode}
                  onChange={(e) => handleAddressChange("billing", "zipCode", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-country" className="block text-sm font-medium text-gray-700">Country</label>
                <input
                  id="billing-country"
                  name="billing-country"
                  type="text"
                  value={billingAddress.country}
                  onChange={(e) => handleAddressChange("billing", "country", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={billingAddress.phone}
                  onChange={(e) => handleAddressChange("billing", "phone", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Payment Element */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
          <PaymentElement />
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                {(error?.includes('OUT_OF_STOCK') || error?.includes('PRODUCT_NOT_FOUND')) && (
                  <Link href="/products" className="mt-2 inline-block text-indigo-600 hover:underline">
                    Return to products
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || loading}
          className={`w-full py-3 px-4 rounded-md text-white font-medium ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading ? "Processing..." : "Complete Order"}
        </button>
      </div>
    </form>
  )
} 