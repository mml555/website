import React, { useState } from 'react';
import { useOrder } from '@/context/OrderContext';
import { useCart } from '@/lib/cart';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

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
  onSubmit: (data: {
    shippingAddress: Address;
    billingAddress?: BillingAddress;
    sameAsShipping: boolean;
  }) => void;
  initialData?: {
    shippingAddress?: Address;
    billingAddress?: BillingAddress;
    sameAsShipping?: boolean;
  };
}

export default function CheckoutForm({ onSubmit, initialData }: CheckoutFormProps) {
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
  const [errors, setErrors] = useState<Partial<Address>>({});
  const { createOrder, error } = useOrder();
  const { items, total } = useCart();

  const validateForm = (): boolean => {
    const newErrors: Partial<Address> = {};

    if (!formData.shippingAddress.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.shippingAddress.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.shippingAddress.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.shippingAddress.street.trim()) {
      newErrors.street = 'Address is required';
    }

    if (!formData.shippingAddress.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.shippingAddress.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.shippingAddress.postalCode.trim()) {
      newErrors.postalCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(formData.shippingAddress.postalCode)) {
      newErrors.postalCode = 'Invalid ZIP code';
    }

    if (!formData.shippingAddress.country.trim()) {
      newErrors.country = 'Country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await createOrder({
        items: items.map((item: CartItem) => ({
          id: item.id,
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        total,
        orderNumber: `ORD-${Date.now()}`,
        status: 'PENDING',
        shippingAddress: {
          name: formData.shippingAddress.name,
          email: formData.shippingAddress.email,
          phone: formData.shippingAddress.phone,
          street: formData.shippingAddress.street,
          city: formData.shippingAddress.city,
          state: formData.shippingAddress.state,
          postalCode: formData.shippingAddress.postalCode,
          country: formData.shippingAddress.country,
        },
        billingAddress: {
          name: formData.billingAddress.name,
          email: formData.billingAddress.email,
          phone: formData.billingAddress.phone,
          street: formData.billingAddress.street,
          city: formData.billingAddress.city,
          state: formData.billingAddress.state,
          postalCode: formData.billingAddress.postalCode,
          country: formData.billingAddress.country,
        },
      });

      // Reset form after successful submission
      setFormData({
        shippingAddress: {
          name: '',
          email: '',
          phone: '',
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        billingAddress: {
          name: '',
          email: '',
          phone: '',
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        sameAsShipping: true,
      });
    } catch (error) {
      // Remove all console.error statements
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name as keyof Address]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.shippingAddress.name}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.name ? 'border-red-500' : ''
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.shippingAddress.email}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.email ? 'border-red-500' : ''
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <input
            type="text"
            id="address"
            name="street"
            value={formData.shippingAddress.street}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.street ? 'border-red-500' : ''
            }`}
          />
          {errors.street && (
            <p className="mt-1 text-sm text-red-600">{errors.street}</p>
          )}
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700">
            City
          </label>
          <input
            type="text"
            id="city"
            name="city"
            value={formData.shippingAddress.city}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.city ? 'border-red-500' : ''
            }`}
          />
          {errors.city && (
            <p className="mt-1 text-sm text-red-600">{errors.city}</p>
          )}
        </div>

        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700">
            State
          </label>
          <input
            type="text"
            id="state"
            name="state"
            value={formData.shippingAddress.state}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.state ? 'border-red-500' : ''
            }`}
          />
          {errors.state && (
            <p className="mt-1 text-sm text-red-600">{errors.state}</p>
          )}
        </div>

        <div>
          <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700">
            ZIP Code
          </label>
          <input
            type="text"
            id="zipCode"
            name="postalCode"
            value={formData.shippingAddress.postalCode}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.postalCode ? 'border-red-500' : ''
            }`}
          />
          {errors.postalCode && (
            <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>
          )}
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Country
          </label>
          <input
            type="text"
            id="country"
            name="country"
            value={formData.shippingAddress.country}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.country ? 'border-red-500' : ''
            }`}
          />
          {errors.country && (
            <p className="mt-1 text-sm text-red-600">{errors.country}</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          className="w-full rounded-md border border-transparent bg-indigo-600 py-3 px-4 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Place Order
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