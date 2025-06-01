"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Mail, CheckCircle, Info, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface Address {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface CheckoutDetailsFormProps {
  items: any[];
  total: number;
  onClientSecret: (clientSecret: string, orderId: string) => void;
  onError?: (err: Error) => void;
}

export default function CheckoutDetailsForm({ items, total, onClientSecret, onError }: CheckoutDetailsFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [shippingAddress, setShippingAddress] = useState<Address>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  });
  const [billingAddress, setBillingAddress] = useState<Address>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  });
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [billingEmailTouched, setBillingEmailTouched] = useState(false);
  const [billingEmailError, setBillingEmailError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [billingEmailSuggestion, setBillingEmailSuggestion] = useState<string | null>(null);

  // RFC 5322 Official Standard regex for email validation
  const rfcEmailRegex = /^(?:[a-zA-Z0-9_'^&/+-])+(?:\.(?:[a-zA-Z0-9_'^&/+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com'];

  function suggestDomain(email: string): string | null {
    const parts = email.split('@');
    if (parts.length !== 2) return null;
    const [local, domain] = parts;
    if (!domain) return null;
    let suggestion = null;
    for (const d of commonDomains) {
      if (d.startsWith(domain) && d !== domain) {
        suggestion = `${local}@${d}`;
        break;
      }
    }
    return suggestion;
  }

  const validateEmail = (email: string) => {
    return rfcEmailRegex.test(email);
  };

  const handleAddressChange = (
    type: 'shipping' | 'billing',
    field: keyof Address,
    value: string
  ) => {
    let val = value;
    if (field === 'email') {
      val = value.trim().toLowerCase();
    }
    if (type === 'shipping') {
      setShippingAddress((prev) => ({ ...prev, [field]: val }));
      if (field === 'email') {
        setEmailTouched(true);
        if (!validateEmail(val)) {
          setEmailError('Please enter a valid email address');
          setEmailSuggestion(suggestDomain(val));
        } else {
          setEmailError(null);
          setEmailSuggestion(null);
        }
      }
      if (sameAsShipping) {
        setBillingAddress((prev) => ({ ...prev, [field]: val }));
        if (field === 'email') {
          setBillingEmailTouched(true);
          if (!validateEmail(val)) {
            setBillingEmailError('Please enter a valid email address');
            setBillingEmailSuggestion(suggestDomain(val));
          } else {
            setBillingEmailError(null);
            setBillingEmailSuggestion(null);
          }
        }
      }
    } else {
      setBillingAddress((prev) => ({ ...prev, [field]: val }));
      if (field === 'email') {
        setBillingEmailTouched(true);
        if (!validateEmail(val)) {
          setBillingEmailError('Please enter a valid email address');
          setBillingEmailSuggestion(suggestDomain(val));
        } else {
          setBillingEmailError(null);
          setBillingEmailSuggestion(null);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const requiredFields: (keyof Address)[] = [
        'name',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'zipCode',
      ];
      const missingShippingFields = requiredFields.filter((field) => !shippingAddress[field]);
      if (missingShippingFields.length > 0) {
        throw new Error(
          `Please fill in all required shipping address fields: ${missingShippingFields.join(', ')}`
        );
      }
      if (!validateEmail(shippingAddress.email)) {
        throw new Error('Please enter a valid email address');
      }
      const phoneRegex = /^\+?[\d\s-]{10,}$/;
      if (!phoneRegex.test(shippingAddress.phone)) {
        throw new Error('Please enter a valid phone number');
      }
      if (!sameAsShipping) {
        const missingBillingFields = requiredFields.filter((field) => !billingAddress[field]);
        if (missingBillingFields.length > 0) {
          throw new Error(
            `Please fill in all required billing address fields: ${missingBillingFields.join(', ')}`
          );
        }
        if (!validateEmail(billingAddress.email)) {
          throw new Error('Please enter a valid billing email address');
        }
        if (!phoneRegex.test(billingAddress.phone)) {
          throw new Error('Please enter a valid billing phone number');
        }
      }
      if (!(typeof total === 'number' && total > 0 && !isNaN(total))) {
        setError('Cart total is invalid. Please check your cart.');
        setLoading(false);
        return;
      }
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId || item.id,
            variantId: item.variantId || undefined,
            quantity: item.quantity,
            price: item.price,
          })),
          total,
          shippingAddress: {
            name: shippingAddress.name,
            email: shippingAddress.email,
            phone: shippingAddress.phone,
            address: shippingAddress.address,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zipCode: shippingAddress.zipCode,
            country: shippingAddress.country || 'United States',
          },
          billingAddress: sameAsShipping
            ? undefined
            : {
                name: billingAddress.name || shippingAddress.name,
                email: billingAddress.email || shippingAddress.email,
                phone: billingAddress.phone || shippingAddress.phone,
                address: billingAddress.address,
                city: billingAddress.city,
                state: billingAddress.state,
                zipCode: billingAddress.zipCode,
                country: billingAddress.country || 'United States',
              },
        }),
      });
      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        if (orderResponse.status === 409 && errorData.code === 'ACCOUNT_EXISTS') {
          setError('An account with this email already exists. Please log in to continue your order.');
          setLoading(false);
          return;
        }
        throw new Error(errorData.message || 'Failed to create order');
      }
      const orderData = await orderResponse.json();
      if (!orderData.clientSecret || !orderData.id) {
        throw new Error('No payment intent or order ID returned from server.');
      }
      onClientSecret(orderData.clientSecret, orderData.id);
    } catch (err: any) {
      setError(err.message || 'An error occurred during checkout');
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipping-name">Full Name</Label>
              <Input
                id="shipping-name"
                value={shippingAddress.name}
                onChange={(e) => handleAddressChange('shipping', 'name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="shipping-email" className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                Email
                <span className="ml-1 group relative">
                  <Info className="h-3 w-3 text-gray-400 group-hover:text-blue-500" />
                  <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 rounded bg-gray-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    Required for order confirmation and digital receipts.
                  </span>
                </span>
                {emailTouched && !emailError && validateEmail(shippingAddress.email) && (
                  <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                )}
              </Label>
              <Input
                id="shipping-email"
                type="email"
                value={shippingAddress.email}
                onChange={(e) => handleAddressChange('shipping', 'email', e.target.value)}
                required
                aria-invalid={!!emailError}
                aria-describedby="shipping-email-error shipping-email-suggestion"
                className={emailError ? 'border-red-500 focus:border-red-500' : ''}
                placeholder="you@example.com"
                autoComplete="email"
                spellCheck={false}
                onPaste={(e) => e.preventDefault()}
              />
              <p className="text-xs text-gray-500">We&apos;ll send your order confirmation here.</p>
              {emailSuggestion && !emailError && (
                <p
                  id="shipping-email-suggestion"
                  className="text-xs text-blue-600 mt-1 cursor-pointer"
                  onClick={() => handleAddressChange('shipping', 'email', emailSuggestion!)}
                >
                  Did you mean <span className="underline">{emailSuggestion}</span>?
                </p>
              )}
              {emailError && emailTouched && (
                <p id="shipping-email-error" className="text-xs text-red-600 mt-1">
                  {emailError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-phone">Phone</Label>
              <Input
                id="shipping-phone"
                type="tel"
                value={shippingAddress.phone}
                onChange={(e) => handleAddressChange('shipping', 'phone', e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="shipping-address">Address</Label>
              <Input
                id="shipping-address"
                value={shippingAddress.address}
                onChange={(e) => handleAddressChange('shipping', 'address', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-city">City</Label>
              <Input
                id="shipping-city"
                value={shippingAddress.city}
                onChange={(e) => handleAddressChange('shipping', 'city', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-state">State</Label>
              <Input
                id="shipping-state"
                value={shippingAddress.state}
                onChange={(e) => handleAddressChange('shipping', 'state', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-zip">ZIP Code</Label>
              <Input
                id="shipping-zip"
                value={shippingAddress.zipCode}
                onChange={(e) => handleAddressChange('shipping', 'zipCode', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping-country">Country</Label>
              <Input
                id="shipping-country"
                value={shippingAddress.country}
                onChange={(e) => handleAddressChange('shipping', 'country', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Billing Address
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="same-as-shipping"
                checked={sameAsShipping}
                onCheckedChange={(checked: boolean) => setSameAsShipping(checked)}
              />
              <Label htmlFor="same-as-shipping">Same as shipping address</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!sameAsShipping && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing-name">Full Name</Label>
                <Input
                  id="billing-name"
                  value={billingAddress.name}
                  onChange={(e) => handleAddressChange('billing', 'name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="billing-email" className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Email
                  <span className="ml-1 group relative">
                    <Info className="h-3 w-3 text-gray-400 group-hover:text-blue-500" />
                    <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 rounded bg-gray-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      Required for billing confirmation and digital receipts.
                    </span>
                  </span>
                  {billingEmailTouched && !billingEmailError && validateEmail(billingAddress.email) && (
                    <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                  )}
                </Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={billingAddress.email}
                  onChange={(e) => handleAddressChange('billing', 'email', e.target.value)}
                  required
                  aria-invalid={!!billingEmailError}
                  aria-describedby="billing-email-error billing-email-suggestion"
                  className={billingEmailError ? 'border-red-500 focus:border-red-500' : ''}
                  placeholder="you@example.com"
                  autoComplete="email"
                  spellCheck={false}
                  onPaste={(e) => e.preventDefault()}
                />
                <p className="text-xs text-gray-500">Billing confirmation will be sent here.</p>
                {billingEmailSuggestion && !billingEmailError && (
                  <p
                    id="billing-email-suggestion"
                    className="text-xs text-blue-600 mt-1 cursor-pointer"
                    onClick={() => handleAddressChange('billing', 'email', billingEmailSuggestion!)}
                  >
                    Did you mean <span className="underline">{billingEmailSuggestion}</span>?
                  </p>
                )}
                {billingEmailError && billingEmailTouched && (
                  <p id="billing-email-error" className="text-xs text-red-600 mt-1">
                    {billingEmailError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-phone">Phone</Label>
                <Input
                  id="billing-phone"
                  type="tel"
                  value={billingAddress.phone}
                  onChange={(e) => handleAddressChange('billing', 'phone', e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="billing-address">Address</Label>
                <Input
                  id="billing-address"
                  value={billingAddress.address}
                  onChange={(e) => handleAddressChange('billing', 'address', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-city">City</Label>
                <Input
                  id="billing-city"
                  value={billingAddress.city}
                  onChange={(e) => handleAddressChange('billing', 'city', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-state">State</Label>
                <Input
                  id="billing-state"
                  value={billingAddress.state}
                  onChange={(e) => handleAddressChange('billing', 'state', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-zip">ZIP Code</Label>
                <Input
                  id="billing-zip"
                  value={billingAddress.zipCode}
                  onChange={(e) => handleAddressChange('billing', 'zipCode', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-country">Country</Label>
                <Input
                  id="billing-country"
                  value={billingAddress.country}
                  onChange={(e) => handleAddressChange('billing', 'country', e.target.value)}
                  required
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            {error.includes('log in') && (
              <>
                <br />
                <Button asChild variant="link" className="mt-2">
                  <a href="/login">Go to Login</a>
                </Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={loading || !!emailError}>
        {loading ? 'Processing...' : 'Continue to Payment'}
      </Button>
    </form>
  );
} 