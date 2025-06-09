"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useCart } from '@/lib/cart'
import { OrderDetails } from '@/types/order'
import { Session } from 'next-auth'

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession() as { data: Session | null }
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { clearCart } = useCart();
  const [cartCleared, setCartCleared] = useState(false);
  const [pendingTimeout, setPendingTimeout] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pollingInterval, setPollingInterval] = useState(60000); // Start with 60 seconds
  const MAX_RETRIES = 3;
  const MAX_INTERVAL = 300000; // 5 minutes
  const MAX_TOTAL_TIME = 30 * 60 * 1000; // 30 minutes total polling time
  const INITIAL_DELAY = 30000; // 30 second delay before first poll
  const BASE_INTERVAL = 60000; // 60 seconds base interval
  const lastRequestTime = useRef<number>(0);
  const MIN_REQUEST_INTERVAL = 5000; // Minimum 5 seconds between requests

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const paymentIntentId = searchParams.get("payment_intent");
        if (!paymentIntentId) {
          setError("No payment intent found");
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/orders?payment_intent=${paymentIntentId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch order details");
        }
        const data = await response.json();
        setOrder(data);
        
        // Clear cart if order is in a final state
        if (data && data.status && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(data.status)) {
          clearCart();
          setCartCleared(true);
          // Clear session storage
          sessionStorage.removeItem('shippingAddress');
          sessionStorage.removeItem('billingAddress');
          sessionStorage.removeItem('shippingRate');
          sessionStorage.removeItem('cartItems');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [searchParams, clearCart]);

  const handleManualRefresh = async () => {
    const paymentIntentId = searchParams.get("payment_intent");
    if (!paymentIntentId) return;

    // Ensure minimum time between requests
    const now = Date.now();
    if (now - lastRequestTime.current < MIN_REQUEST_INTERVAL) {
      setError("Please wait a few seconds before trying again.");
      return;
    }
    lastRequestTime.current = now;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders?payment_intent=${paymentIntentId}`);
      if (response.status === 429) {
        setError("Too many requests. Please try again in a few minutes.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch order details");
      }
      const data = await response.json();
      setOrder(data);
      
      // Clear cart if order is in a final state
      if (data && data.status && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(data.status)) {
        clearCart();
        setCartCleared(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading order details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4 text-center">{error}</div>
        <button
          onClick={handleManualRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          disabled={loading}
        >
          {loading ? "Loading..." : "Try Again"}
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-gray-600 mb-4">Order not found</div>
        <button
          onClick={handleManualRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Order Confirmation</h1>
          <a
            href="/"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Back to Home
          </a>
        </div>
        
        {order.status === "PENDING" && !pendingTimeout && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Your order is being processed. This page will automatically update when the payment is confirmed.
                </p>
              </div>
            </div>
          </div>
        )}

        {pendingTimeout && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  The order is taking longer than expected to process. Please contact support if you have already been charged.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
              {order.shippingAddress && (
                <div className="text-gray-600">
                  <p>{order.shippingAddress.name}</p>
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                  <p>{order.shippingAddress.country}</p>
                  <p className="mt-2">Email: {order.shippingAddress.email}</p>
                  {order.shippingAddress.phone && (
                    <p>Phone: {order.shippingAddress.phone}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Billing Address</h2>
              {order.billingAddress ? (
                <div className="text-gray-600">
                  <p>{order.billingAddress.name}</p>
                  <p>{order.billingAddress.street}</p>
                  <p>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}</p>
                  <p>{order.billingAddress.country}</p>
                  <p className="mt-2">Email: {order.billingAddress.email}</p>
                  {order.billingAddress.phone && (
                    <p>Phone: {order.billingAddress.phone}</p>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 italic">
                  Same as shipping address
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Order Number:</span>
              <span className="font-medium">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                order.status === "PAID" ? "text-green-600" :
                order.status === "PROCESSING" ? "text-blue-600" :
                order.status === "SHIPPED" ? "text-purple-600" :
                order.status === "DELIVERED" ? "text-green-600" :
                "text-yellow-600"
              }`}>
                {order.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium">${order.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Shipping Address</h3>
              <div className="space-y-2">
                <p className="font-medium">{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.street}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
                {order.shippingAddress.email && <p>Email: {order.shippingAddress.email}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Billing Address</h3>
              <div className="space-y-2">
                <p className="font-medium">{order.billingAddress.name}</p>
                <p>{order.billingAddress.street}</p>
                <p>{order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}</p>
                <p>{order.billingAddress.country}</p>
                {order.billingAddress.phone && <p>Phone: {order.billingAddress.phone}</p>}
                {order.billingAddress.email && <p>Email: {order.billingAddress.email}</p>}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Items</h3>
            <div className="space-y-4">
              {order.items.map((item: OrderDetails['items'][0]) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 