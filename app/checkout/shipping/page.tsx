"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import { calculateTax, isValidUSAddress, US_STATES, TaxCalculation, getCountiesForState } from '@/lib/tax-calculator'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Address {
  street: string;
  city: string;
  state: string;
  county: string;
  postalCode: string;
  country: string;
}

interface BillingAddress extends Address {
  name: string;
  email: string;
  phone?: string;
}

// Shipping rates based on order total
const SHIPPING_RATES = {
  STANDARD: {
    name: 'Standard Shipping',
    rate: 5.99,
    minOrder: 0,
    maxOrder: 50
  },
  EXPRESS: {
    name: 'Express Shipping',
    rate: 12.99,
    minOrder: 0,
    maxOrder: 100
  },
  FREE: {
    name: 'Free Shipping',
    rate: 0,
    minOrder: 50,
    maxOrder: Infinity
  }
}

export default function ShippingPage() {
  const router = useRouter()
  const { items, total: cartTotal } = useCart()
  const [error, setError] = useState<string | null>(null)
  const [shippingAddress, setShippingAddress] = useState<Address>({
    street: '',
    city: '',
    state: '',
    county: '',
    postalCode: '',
    country: 'USA'
  })
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    name: '',
    email: '',
    street: '',
    city: '',
    state: '',
    county: '',
    postalCode: '',
    country: 'USA',
    phone: ''
  })
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [taxCalculation, setTaxCalculation] = useState<TaxCalculation | null>(null)
  const [availableCounties, setAvailableCounties] = useState<string[]>([])
  const [selectedShipping, setSelectedShipping] = useState(SHIPPING_RATES.STANDARD)

  const MINIMUM_AMOUNT = 0.50

  // Update available counties when state changes
  useEffect(() => {
    if (shippingAddress.state) {
      const counties = getCountiesForState(shippingAddress.state)
      setAvailableCounties(counties)
      if (counties.length > 0 && !counties.includes(shippingAddress.county)) {
        setShippingAddress(prev => ({ ...prev, county: counties[0] }))
      }
    }
  }, [shippingAddress.state, shippingAddress.county])

  // Update tax calculation when shipping state or county changes
  useEffect(() => {
    if (shippingAddress.state) {
      const calculation = calculateTax(
        cartTotal,
        shippingAddress.state,
        shippingAddress.county
      )
      setTaxCalculation(calculation)
    }
  }, [shippingAddress.state, shippingAddress.county, cartTotal])

  // Update shipping rate based on order total
  useEffect(() => {
    if (cartTotal >= SHIPPING_RATES.FREE.minOrder) {
      setSelectedShipping(SHIPPING_RATES.FREE)
    } else if (cartTotal >= SHIPPING_RATES.STANDARD.minOrder) {
      setSelectedShipping(SHIPPING_RATES.STANDARD)
    }
  }, [cartTotal])

  const handleAddressChange = (
    type: 'shipping' | 'billing',
    field: keyof Address | keyof BillingAddress,
    value: string
  ) => {
    if (type === 'shipping') {
      setShippingAddress(prev => ({ ...prev, [field]: value }))
      if (sameAsShipping) {
        setBillingAddress(prev => ({ ...prev, [field]: value }))
      }
    } else {
      setBillingAddress(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (cartTotal < MINIMUM_AMOUNT) {
      setError(`Order total must be at least $${MINIMUM_AMOUNT.toFixed(2)}`)
      return
    }

    if (!isValidUSAddress(shippingAddress)) {
      setError('Please enter a valid US shipping address')
      return
    }

    if (!sameAsShipping && !isValidUSAddress(billingAddress)) {
      setError('Please enter a valid US billing address')
      return
    }

    // Validate required fields
    const requiredShippingFields: (keyof Address)[] = ['street', 'city', 'state', 'postalCode', 'country']
    const requiredBillingFields: (keyof BillingAddress)[] = ['name', 'email', 'street', 'city', 'state', 'postalCode', 'country']

    const missingShippingFields = requiredShippingFields.filter(field => !shippingAddress[field])
    const missingBillingFields = requiredBillingFields.filter(field => !billingAddress[field])

    if (missingShippingFields.length > 0) {
      setError(`Missing shipping fields: ${missingShippingFields.join(', ')}`)
      return
    }

    if (missingBillingFields.length > 0) {
      setError(`Missing billing fields: ${missingBillingFields.join(', ')}`)
      return
    }

    // Store addresses in session storage
    sessionStorage.setItem('shippingAddress', JSON.stringify(shippingAddress))
    sessionStorage.setItem('billingAddress', JSON.stringify(billingAddress))
    sessionStorage.setItem('shippingRate', JSON.stringify(selectedShipping))

    // Navigate to payment page
    router.push('/checkout/payment')
  }

  const totalWithShipping = taxCalculation ? taxCalculation.total + selectedShipping.rate : cartTotal + selectedShipping.rate

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">Shipping Information</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              {taxCalculation && (
                <>
                  <div className="flex justify-between">
                    <span>State Tax ({shippingAddress.state} - {(taxCalculation.stateTaxRate * 100).toFixed(2)}%):</span>
                    <span>${taxCalculation.stateTaxAmount.toFixed(2)}</span>
                  </div>
                  {taxCalculation.countyTaxRate > 0 && (
                    <div className="flex justify-between">
                      <span>County Tax ({shippingAddress.county} - {(taxCalculation.countyTaxRate * 100).toFixed(2)}%):</span>
                      <span>${taxCalculation.countyTaxAmount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <span>Shipping ({selectedShipping.name}):</span>
                <span>${selectedShipping.rate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>Total:</span>
                <span>${totalWithShipping.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="col-span-2">
                <label htmlFor="shipping-street" className="block text-sm font-medium text-gray-700">
                  Street Address
                </label>
                <input
                  type="text"
                  id="shipping-street"
                  value={shippingAddress.street}
                  onChange={(e) => handleAddressChange('shipping', 'street', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="shipping-city" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  id="shipping-city"
                  value={shippingAddress.city}
                  onChange={(e) => handleAddressChange('shipping', 'city', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="shipping-state" className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <select
                  id="shipping-state"
                  value={shippingAddress.state}
                  onChange={(e) => handleAddressChange('shipping', 'state', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="">Select a state</option>
                  {US_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              {availableCounties.length > 0 && (
                <div>
                  <label htmlFor="shipping-county" className="block text-sm font-medium text-gray-700">
                    County
                  </label>
                  <select
                    id="shipping-county"
                    value={shippingAddress.county}
                    onChange={(e) => handleAddressChange('shipping', 'county', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">Select a county</option>
                    {availableCounties.map(county => (
                      <option key={county} value={county}>{county}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="shipping-postalCode" className="block text-sm font-medium text-gray-700">
                  ZIP Code
                </label>
                <input
                  type="text"
                  id="shipping-postalCode"
                  value={shippingAddress.postalCode}
                  onChange={(e) => handleAddressChange('shipping', 'postalCode', e.target.value)}
                  pattern="^\d{5}(-\d{4})?$"
                  placeholder="12345 or 12345-6789"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Billing Address</CardTitle>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="same-as-shipping"
                  checked={sameAsShipping}
                  onChange={(e) => {
                    setSameAsShipping(e.target.checked)
                    if (e.target.checked) {
                      setBillingAddress({
                        ...shippingAddress,
                        name: billingAddress.name,
                        email: billingAddress.email,
                        phone: billingAddress.phone
                      })
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="same-as-shipping" className="ml-2 block text-sm text-gray-900">
                  Same as shipping address
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="billing-name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="billing-name"
                  value={billingAddress.name}
                  onChange={(e) => handleAddressChange('billing', 'name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="billing-email"
                  value={billingAddress.email}
                  onChange={(e) => handleAddressChange('billing', 'email', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="billing-phone" className="block text-sm font-medium text-gray-700">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  id="billing-phone"
                  value={billingAddress.phone}
                  onChange={(e) => handleAddressChange('billing', 'phone', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              {!sameAsShipping && (
                <>
                  <div className="col-span-2">
                    <label htmlFor="billing-street" className="block text-sm font-medium text-gray-700">
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="billing-street"
                      value={billingAddress.street}
                      onChange={(e) => handleAddressChange('billing', 'street', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="billing-city" className="block text-sm font-medium text-gray-700">
                      City
                    </label>
                    <input
                      type="text"
                      id="billing-city"
                      value={billingAddress.city}
                      onChange={(e) => handleAddressChange('billing', 'city', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="billing-state" className="block text-sm font-medium text-gray-700">
                      State
                    </label>
                    <select
                      id="billing-state"
                      value={billingAddress.state}
                      onChange={(e) => handleAddressChange('billing', 'state', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">Select a state</option>
                      {US_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  {availableCounties.length > 0 && (
                    <div>
                      <label htmlFor="billing-county" className="block text-sm font-medium text-gray-700">
                        County
                      </label>
                      <select
                        id="billing-county"
                        value={billingAddress.county}
                        onChange={(e) => handleAddressChange('billing', 'county', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="">Select a county</option>
                        {availableCounties.map(county => (
                          <option key={county} value={county}>{county}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="billing-postalCode" className="block text-sm font-medium text-gray-700">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      id="billing-postalCode"
                      value={billingAddress.postalCode}
                      onChange={(e) => handleAddressChange('billing', 'postalCode', e.target.value)}
                      pattern="^\d{5}(-\d{4})?$"
                      placeholder="12345 or 12345-6789"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Method */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.values(SHIPPING_RATES).map((method) => (
                <div
                  key={method.name}
                  className={`flex items-center p-4 border rounded-md cursor-pointer ${
                    selectedShipping.name === method.name
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedShipping(method)}
                >
                  <input
                    type="radio"
                    name="shipping-method"
                    checked={selectedShipping.name === method.name}
                    onChange={() => setSelectedShipping(method)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="ml-3">
                    <label className="block text-sm font-medium text-gray-900">
                      {method.name}
                    </label>
                    <p className="text-sm text-gray-500">
                      {method.rate === 0 ? 'Free' : `$${method.rate.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={cartTotal < MINIMUM_AMOUNT}
        >
          Continue to Payment
        </Button>
      </form>
    </div>
  )
} 