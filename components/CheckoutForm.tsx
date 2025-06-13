import React, { useState } from 'react';
import { useOrder } from '@/context/OrderContext';
import { useCart, type CartContextType, type CartItemInput } from '@/lib/cart';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { z } from 'zod';
import Link from 'next/link';
import type { CartItem } from '@/types/product';

interface Address {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface BillingAddress {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CheckoutFormProps {
  onSubmit?: (data: any) => void;
  initialData?: any;
  clientSecret?: string;
  orderId?: string;
  onPaying?: (isPaying: boolean) => void;
  onSuccess?: () => void;
}

const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?\d+$/, 'Invalid phone format'),
  street: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  country: z.string().min(1, 'Country is required'),
});

export default function CheckoutForm({ onSubmit, initialData, clientSecret, orderId, onPaying, onSuccess }: CheckoutFormProps) {
  const [formData, setFormData] = useState({
    shippingAddress: {
      name: initialData?.shippingAddress?.name || '',
      email: initialData?.shippingAddress?.email || '',
      phone: initialData?.shippingAddress?.phone || '',
      street: initialData?.shippingAddress?.street || '',
      city: initialData?.shippingAddress?.city || '',
      state: initialData?.shippingAddress?.state || '',
      postalCode: initialData?.shippingAddress?.postalCode || '',
      country: initialData?.shippingAddress?.country || '',
    },
    billingAddress: {
      name: initialData?.billingAddress?.name || '',
      email: initialData?.billingAddress?.email || '',
      phone: initialData?.billingAddress?.phone || '',
      street: initialData?.billingAddress?.street || '',
      city: initialData?.billingAddress?.city || '',
      state: initialData?.billingAddress?.state || '',
      postalCode: initialData?.billingAddress?.postalCode || '',
      country: initialData?.billingAddress?.country || '',
    },
    sameAsShipping: initialData?.sameAsShipping ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const { createOrder } = useOrder();
  const cart = useCart();
  const router = useRouter();
  const { data: session } = useSession();
  const stripe = useStripe();
  const elements = useElements();

  const validateField = (field: string, value: string, type: 'shipping' | 'billing') => {
    try {
      const address = type === 'shipping' ? formData.shippingAddress : formData.billingAddress;
      const testAddress = { ...address, [field]: value };
      addressSchema.parse(testAddress);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find(err => err.path.includes(field));
        return fieldError?.message || null;
      }
      return null;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const [type, field] = name.split('-');
    
    setFormData((prev) => ({
      ...prev,
      [type === 'shipping' ? 'shippingAddress' : 'billingAddress']: {
        ...prev[type === 'shipping' ? 'shippingAddress' : 'billingAddress'],
        [field]: value,
      },
    }));

    // Validate field in real-time
    const error = validateField(field, value, type as 'shipping' | 'billing');
    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[`${type}-${field}`] = error;
      } else {
        delete newErrors[`${type}-${field}`];
      }
      return newErrors;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Validate shipping address
    try {
      addressSchema.parse(formData.shippingAddress);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          const field = err.path[0];
          newErrors[`shipping-${field}`] = err.message;
        });
        isValid = false;
      }
    }

    // Validate billing address if different from shipping
    if (!formData.sameAsShipping) {
      try {
        addressSchema.parse(formData.billingAddress);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(err => {
            const field = err.path[0];
            newErrors[`billing-${field}`] = err.message;
          });
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    if (!stripe || !elements) {
      setError('Payment system not ready');
      return;
    }

    setLoading(true);
    setError(null);
    if (onPaying) onPaying(true);

    try {
      // Set guest session before payment if not logged in
      if (!session?.user) {
        const email = formData.billingAddress.email || formData.shippingAddress.email;
        if (email) {
          localStorage.setItem('guestSession', email);
          console.log('Set guest session:', email);
        }
      }

      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
          payment_method_data: {
            billing_details: {
              name: formData.billingAddress.name || '',
              email: formData.billingAddress.email || '',
              phone: formData.billingAddress.phone || '',
              address: {
                line1: formData.billingAddress.street || '',
                line2: '',
                city: formData.billingAddress.city || '',
                state: formData.billingAddress.state || '',
                postal_code: formData.billingAddress.postalCode || '',
                country: formData.billingAddress.country === 'USA' ? 'US' : formData.billingAddress.country || '',
              },
            },
          },
        },
      });

      if (submitError) {
        setError(submitError.message || 'An error occurred while processing your payment.');
      } else {
        setRedirecting(true);
        if (onSuccess) onSuccess();
        if (orderId) {
          router.push(`/order-confirmation/${orderId}`);
        } else {
          const paymentIntentId = clientSecret?.split('_secret_')[0];
          router.push(`/order-confirmation?payment_intent=${paymentIntentId}`);
        }
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing your payment.');
    } finally {
      setLoading(false);
      if (onPaying) onPaying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="shipping-name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            id="shipping-name"
            name="shipping-name"
            value={formData.shippingAddress.name}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-name'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-name'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-name']}</p>
          )}
        </div>

        <div>
          <label htmlFor="shipping-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="shipping-email"
            name="shipping-email"
            value={formData.shippingAddress.email}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-email'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-email'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-email']}</p>
          )}
        </div>

        <div>
          <label htmlFor="shipping-phone" className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            type="tel"
            id="shipping-phone"
            name="shipping-phone"
            value={formData.shippingAddress.phone}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-phone'] ? 'border-red-500' : ''
            }`}
            placeholder="+1234567890"
          />
          {errors['shipping-phone'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-phone']}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="shipping-address" className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <input
            type="text"
            id="shipping-address"
            name="shipping-street"
            value={formData.shippingAddress.street}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-street'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-street'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-street']}</p>
          )}
        </div>

        <div>
          <label htmlFor="shipping-city" className="block text-sm font-medium text-gray-700">
            City
          </label>
          <input
            type="text"
            id="shipping-city"
            name="shipping-city"
            value={formData.shippingAddress.city}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-city'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-city'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-city']}</p>
          )}
        </div>

        <div>
          <label htmlFor="shipping-state" className="block text-sm font-medium text-gray-700">
            State
          </label>
          <input
            type="text"
            id="shipping-state"
            name="shipping-state"
            value={formData.shippingAddress.state}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-state'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-state'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-state']}</p>
          )}
        </div>

        <div>
          <label htmlFor="shipping-zipCode" className="block text-sm font-medium text-gray-700">
            ZIP Code
          </label>
          <input
            type="text"
            id="shipping-zipCode"
            name="shipping-postalCode"
            value={formData.shippingAddress.postalCode}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-postalCode'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-postalCode'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-postalCode']}</p>
          )}
        </div>

        <div>
          <label htmlFor="shipping-country" className="block text-sm font-medium text-gray-700">
            Country
          </label>
          <input
            type="text"
            id="shipping-country"
            name="shipping-country"
            value={formData.shippingAddress.country}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors['shipping-country'] ? 'border-red-500' : ''
            }`}
          />
          {errors['shipping-country'] && (
            <p className="mt-1 text-sm text-red-600">{errors['shipping-country']}</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-transparent bg-indigo-600 py-3 px-4 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </div>
      {error && (
        <div className="mt-2 text-red-600 text-sm" role="alert">
          {error}
        </div>
      )}
    </form>
  );
} 