"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart'
import type { CartItem as CartCartItem } from '@/types/cart'
import type { CartItem as ProductCartItem } from '@/types/product'
import { calculateTax, isValidUSAddress, TaxCalculation } from '@/lib/tax-calculator'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from 'next-auth/react'
import { ShippingAddress, BillingAddress, validateShippingAddress, validateBillingAddress } from '@/types/address'
import { calculateShippingOptions, isValidShippingOption } from '@/lib/shipping'
import { safeSessionStorage } from '@/lib/session-storage'
import { shippingAddressSchema, billingAddressSchema } from '@/types/address'
import { z } from 'zod'

// Define shipping rate interface
interface ShippingRate {
  id: string;
  name: string;
  rate: number;
  description?: string;
  estimatedDays: number;
}

// Define shipping option type
type ShippingOption = {
  id: string;
  name: string;
  rate: number;
  estimatedDays: number;
};

// Update address book type
interface SavedAddress extends ShippingAddress {
  id: string;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }
]

type CartItemType = CartCartItem | ProductCartItem;

// Helper function to validate and format price
const validatePrice = (price: any): number => {
  const numPrice = typeof price === 'number' ? price :
                  typeof price === 'string' ? parseFloat(price) : 0;
  return isNaN(numPrice) || numPrice < 0 ? 0 : numPrice;
};

// Helper function to get item price with validation
const getItemPrice = (item: CartItemType | ProductCartItem): number => {
  if ('product' in item && item.product) {
    return validatePrice(item.product.price);
  }
  return validatePrice(item.price);
};

// Helper function to get original price with validation
const getOriginalPrice = (item: CartItemType | ProductCartItem): number => {
  if ('product' in item && item.product) {
    return validatePrice(item.product.price); // Use product price as original if no originalPrice
  }
  return validatePrice(item.originalPrice || item.price);
};

export default function ShippingPage() {
  const router = useRouter()
  const { items: cartItems, isLoading: cartLoading } = useCart()
  const [items, setItems] = useState<CartItemType[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isAddressComplete, setIsAddressComplete] = useState(false)
  const [selectedShipping, setSelectedShipping] = useState<ShippingRate | null>(null)
  const [taxCalculation, setTaxCalculation] = useState<any>(null)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [shippingLoading, setShippingLoading] = useState(false)
  const [cartTotal, setCartTotal] = useState(0)
  const [isDataReady, setIsDataReady] = useState(false)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    type: 'SHIPPING'
  })
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    type: 'BILLING'
  })
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const { data: session, status } = useSession()
  const isLoggedIn = !!session?.user
  const [addressBook, setAddressBook] = useState<SavedAddress[]>([])
  const [addressBookLoading, setAddressBookLoading] = useState(false)
  const [addressBookError, setAddressBookError] = useState<string | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressSaved, setAddressSaved] = useState(false)
  const [totalWithShipping, setTotalWithShipping] = useState(0)
  const [hasSelectedShipping, setHasSelectedShipping] = useState(false)
  const [hasTaxCalculation, setHasTaxCalculation] = useState(false)

  // First effect: Load cart items and product details
  useEffect(() => {
    const loadCartData = async () => {
      if (cartLoading) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Check if cart is empty
        if (!cartItems || cartItems.length === 0) {
          console.error('Shipping error: "Your cart is empty"');
          setError('Your cart is empty. Please add items to your cart before proceeding to checkout.');
          router.push('/cart');
          return;
        }

        // Fetch missing product details
        const updatedItems = await Promise.all(
          cartItems.map(async (item: CartItemType) => {
            try {
              // If item already has complete data, return it
              if ('product' in item) {
                if (item.product?.price && item.product?.name && item.product?.id) {
                  return item;
                }
              } else {
                if (item.price && item.name && item.id) {
                  return item;
                }
              }

              // Fetch missing product details
              const response = await fetch(`/api/products/${item.productId}`);
              if (!response.ok) {
                throw new Error(`Failed to fetch product details for ${item.productId}`);
              }

              const productData = await response.json();
              
              // Validate product data
              if (!productData.id || !productData.name || !productData.price) {
                throw new Error('Invalid product data received');
              }

              return {
                ...item,
                product: {
                  id: productData.id,
                  name: productData.name,
                  price: productData.price,
                  images: productData.images || [],
                  stock: productData.stock || 0
                }
              } as CartCartItem;
            } catch (err) {
              console.error('Error processing cart item:', err);
              throw err;
            }
          })
        );

        // Validate all items have required data
        const validItems = updatedItems.filter(item => {
          if ('product' in item) {
            return item.product?.price && item.product?.name && item.product?.id;
          }
          return item.price && item.name && item.id;
        });

        if (validItems.length !== updatedItems.length) {
          throw new Error('Some items could not be loaded properly');
        }

        setItems(validItems);
        setIsDataReady(true);
      } catch (err) {
        console.error('Error loading cart data:', err);
        setError('Failed to load cart data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadCartData();
  }, [cartItems, cartLoading, router]);

  // Second effect: Calculate cart total when items change
  useEffect(() => {
    const calculateTotal = () => {
      if (!isDataReady) {
        return;
      }

      const total = items.reduce((sum, item) => {
        const price = getItemPrice(item);
        return sum + (price * item.quantity);
      }, 0);
      setCartTotal(total);
    };

    calculateTotal();
  }, [items, isDataReady]);

  // Third effect: Load shipping options when data is ready
  useEffect(() => {
    const loadShippingOptions = async () => {
      if (!isDataReady || !items.length || !shippingAddress?.postalCode) {
        return;
      }

      setShippingLoading(true);
      try {
        // Validate shipping address
        const addressError = validateShippingAddress(shippingAddress);
        if (addressError) {
          throw new Error(addressError);
        }

        const response = await fetch('/api/shipping/rates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: items.map(item => ({
              id: item.id,
              quantity: item.quantity,
              price: getItemPrice(item),
              weight: 1, // Default weight since it's not in the type
              dimensions: {
                length: 10, // Default dimensions
                width: 10,
                height: 10
              }
            })),
            address: {
              name: shippingAddress.name,
              email: shippingAddress.email,
              phone: shippingAddress.phone,
              street: shippingAddress.street,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postalCode: shippingAddress.postalCode,
              country: shippingAddress.country,
              type: 'SHIPPING'
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load shipping options');
        }

        const data = await response.json();
        setShippingOptions(data.shippingOptions || []);
        
        // Select the first shipping option by default
        if (data.shippingOptions?.length > 0) {
          setSelectedShipping(data.shippingOptions[0]);
          setHasSelectedShipping(true);
        }
      } catch (err) {
        console.error('Error loading shipping options:', err);
        setError(err instanceof Error ? err.message : 'Failed to load shipping options. Please try again.');
      } finally {
        setShippingLoading(false);
      }
    };

    loadShippingOptions();
  }, [items, shippingAddress, isDataReady]);

  // Render loading state
  if (cartLoading || shippingLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                  <h3 className="mt-2 text-lg font-medium text-gray-900">
                    {cartLoading ? 'Loading your cart...' : 'Loading shipping options...'}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const MINIMUM_AMOUNT = 0.50

  // Utility function to safely handle sessionStorage operations
  const safeSessionStorage = {
    set: (key: string, value: any) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (err) {
        console.error(`Failed to save ${key} to sessionStorage:`, err)
        setError(`Failed to save checkout data. Please try again.`)
        return false
      }
    },
    get: (key: string) => {
      try {
        const item = sessionStorage.getItem(key)
        return item ? JSON.parse(item) : null
      } catch (err) {
        console.error(`Failed to read ${key} from sessionStorage:`, err)
        setError(`Failed to load checkout data. Please try again.`)
        return null
      }
    },
    remove: (key: string) => {
      try {
        sessionStorage.removeItem(key)
        return true
      } catch (err) {
        console.error(`Failed to remove ${key} from sessionStorage:`, err)
        return false
      }
    }
  }

  // Load saved data from session storage
  useEffect(() => {
    const loadSavedData = () => {
      try {
        const savedShippingAddress = safeSessionStorage.get('checkout.shippingAddress')
        if (savedShippingAddress) {
          // Ensure all fields are strings
          const processedShippingAddress = {
            name: String(savedShippingAddress.name || ''),
            email: String(savedShippingAddress.email || ''),
            street: String(savedShippingAddress.street || ''),
            city: String(savedShippingAddress.city || ''),
            state: String(savedShippingAddress.state || ''),
            postalCode: String(savedShippingAddress.postalCode || ''),
            country: String(savedShippingAddress.country || 'US'),
            phone: String(savedShippingAddress.phone || ''),
            type: savedShippingAddress.type
          }
          setShippingAddress(processedShippingAddress)
        }

        const savedBillingAddress = safeSessionStorage.get('checkout.billingAddress')
        if (savedBillingAddress) {
          // Ensure all fields are strings
          const processedBillingAddress = {
            name: String(savedBillingAddress.name || ''),
            email: String(savedBillingAddress.email || ''),
            street: String(savedBillingAddress.street || ''),
            city: String(savedBillingAddress.city || ''),
            state: String(savedBillingAddress.state || ''),
            postalCode: String(savedBillingAddress.postalCode || ''),
            country: String(savedBillingAddress.country || 'US'),
            phone: String(savedBillingAddress.phone || ''),
            type: savedBillingAddress.type
          }
          setBillingAddress(processedBillingAddress)
        }

        const savedTax = safeSessionStorage.get('checkout.taxAmount')
        if (savedTax) {
          setTaxCalculation({
            stateTaxRate: 0,
            stateTaxAmount: Number(savedTax) || 0,
            totalWithTax: 0
          })
        }

        const savedShipping = safeSessionStorage.get('checkout.shippingRate')
        if (savedShipping) {
          setSelectedShipping(savedShipping as ShippingRate)
        }

        const savedTotal = safeSessionStorage.get('checkout.calculatedTotal')
        if (savedTotal) {
          setTotalWithShipping(Number(savedTotal) || 0)
        }
      } catch (err) {
        console.error('Error loading saved data:', err)
        setError('Failed to load saved checkout information')
      }
    }

    loadSavedData()
  }, [])

  // Initialize shipping state from session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = sessionStorage.getItem('shippingState');
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setIsAddressComplete(parsedState.isAddressComplete || false);
          setHasSelectedShipping(parsedState.hasSelectedShipping || false);
          setHasTaxCalculation(parsedState.hasTaxCalculation || false);
        } catch (err) {
          console.error('Error parsing saved shipping state:', err);
        }
      }
    }
  }, []);

  // Save shipping state to session storage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const state = {
        isAddressComplete,
        hasSelectedShipping,
        hasTaxCalculation
      };
      sessionStorage.setItem('shippingState', JSON.stringify(state));
    }
  }, [isAddressComplete, hasSelectedShipping, hasTaxCalculation]);

  // Update address completion status whenever shipping address changes
  useEffect(() => {
    const isComplete = validateAddress(shippingAddress);
    setIsAddressComplete(isComplete);
    
    // If address becomes incomplete, reset shipping and tax calculations
    if (!isComplete) {
      setHasSelectedShipping(false);
      setHasTaxCalculation(false);
      setSelectedShipping(null);
      setTaxCalculation(null);
    }
  }, [shippingAddress]);

  // Calculate shipping options when address is complete
  useEffect(() => {
    if (isAddressComplete && !hasSelectedShipping) {
      calculateShipping();
    }
  }, [isAddressComplete, hasSelectedShipping]);

  // Calculate tax when address is complete and shipping is selected
  useEffect(() => {
    if (isAddressComplete && hasSelectedShipping && !hasTaxCalculation) {
      calculateTaxForAddress();
    }
  }, [isAddressComplete, hasSelectedShipping, hasTaxCalculation]);

  const validateAddress = (address: ShippingAddress | BillingAddress): boolean => {
    try {
      // Only validate if we have at least some data
      if (!address.name && !address.email && !address.street) {
        return false;
      }

      // Create a schema that validates the address structure
      const addressSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Valid email is required'),
        phone: z.string().optional(),
        street: z.string().min(1, 'Street address is required'),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        postalCode: z.string().min(1, 'Postal code is required'),
        country: z.string().min(1, 'Country is required'),
        type: z.enum(['SHIPPING', 'BILLING']).optional()
      });

      // Validate the address
      const result = addressSchema.safeParse(address);
      
      if (!result.success) {
        console.error('Address validation error:', result.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Address validation error:', error);
      return false;
    }
  };

  const handleAddressChange = (
    type: 'shipping' | 'billing',
    field: keyof ShippingAddress | keyof BillingAddress,
    value: string
  ) => {
    if (type === 'shipping') {
      const newAddress = { ...shippingAddress, [field]: value };
      setShippingAddress(newAddress);
      safeSessionStorage.set('checkout.shippingAddress', newAddress);
    } else {
      const newAddress = { ...billingAddress, [field]: value };
      setBillingAddress(newAddress);
      safeSessionStorage.set('checkout.billingAddress', newAddress);
    }
  };

  // Add effect to calculate shipping when cart is loaded and address is complete
  useEffect(() => {
    if (!cartLoading && items.length > 0 && isAddressComplete) {
      calculateShipping();
    }
  }, [cartLoading, items, isAddressComplete]);

  const calculateShipping = async () => {
    if (!isAddressComplete) {
      setShippingError('Please complete the shipping address first');
      return;
    }

    // Validate cart items
    if (!items || items.length === 0) {
      setShippingError('Your cart is empty');
      return;
    }

    // Validate each item has valid price and quantity
    const invalidItems = items.filter(item => {
      try {
        // Ensure item has required properties
        if (!item.productId) {
          console.error('Item missing productId:', item);
          return true;
        }

        // Get price based on item type
        const price = getItemPrice(item);

        // Ensure price is valid
        if (!price || isNaN(price) || price <= 0) {
          console.error('Invalid price for item:', { item, price });
          return true;
        }

        // Ensure quantity is valid
        const quantity = typeof item.quantity === 'string' 
          ? parseInt(item.quantity) 
          : (item.quantity || 0);

        if (!quantity || isNaN(quantity) || quantity <= 0) {
          console.error('Invalid quantity for item:', { item, quantity });
          return true;
        }

        // Ensure item has a name
        const name = 'product' in item 
          ? (item.product?.name || '')
          : (item.name || '');

        if (!name) {
          console.error('Item missing name:', item);
          return true;
        }

        return false;
      } catch (err) {
        console.error('Error validating cart item:', err);
        return true;
      }
    });

    if (invalidItems.length > 0) {
      console.error('Invalid cart items:', invalidItems);
      setShippingError('Some items in your cart have invalid data. Please return to cart and try again.');
      return;
    }

    if (!cartTotal || cartTotal <= 0) {
      setShippingError('Cart total must be greater than 0');
      return;
    }

    setShippingLoading(true);
    setShippingError(null);

    try {
      // Ensure we have valid numbers
      const total = typeof cartTotal === 'number' && !isNaN(cartTotal) ? cartTotal : 0;
      
      if (total <= 0) {
        throw new Error('Cart total must be greater than 0');
      }
      
      // Create a properly formatted shipping address
      const formattedAddress = {
        ...shippingAddress,
        country: shippingAddress.country || 'US', // Default to US if not set
        state: shippingAddress.state || '',
        postalCode: shippingAddress.postalCode || '',
        type: 'SHIPPING' as const
      };

      const options = calculateShippingOptions({
        address: formattedAddress,
        total: total,
        weight: 1 // Default weight
      });

      if (!options || options.length === 0) {
        throw new Error('No shipping options available for this address');
      }

      setShippingOptions(options);
      
      // Auto-select the first available option
      if (options.length > 0) {
        handleShippingRateSelect(options[0]);
      }

      // Save shipping state to session storage
      safeSessionStorage.set('checkout.shippingOptions', options);
      if (options.length > 0) {
        safeSessionStorage.set('checkout.selectedShipping', options[0]);
      }
    } catch (err) {
      console.error('Error calculating shipping:', err);
      setShippingError(err instanceof Error ? err.message : 'Failed to calculate shipping options. Please try again.');
    } finally {
      setShippingLoading(false);
    }
  };

  const calculateTaxForAddress = async () => {
    if (!isAddressComplete || !hasSelectedShipping) {
      return;
    }

    try {
      const taxResult = calculateTax(cartTotal, shippingAddress.state);
      setTaxCalculation({
        stateTaxRate: taxResult.rate,
        stateTaxAmount: taxResult.tax,
        totalWithTax: taxResult.total
      });
      setHasTaxCalculation(true);
      safeSessionStorage.set('checkout.taxAmount', taxResult.tax);
    } catch (err) {
      console.error('Error calculating tax:', err);
      setError('Failed to calculate tax. Please try again.');
    }
  };

  const handleShippingRateSelect = (rate: ShippingOption) => {
    setSelectedShipping(rate);
    setHasSelectedShipping(true);
    safeSessionStorage.set('checkout.shippingRate', rate);
    recalculateTotal();
  };

  // Recalculate total with shipping and tax
  const recalculateTotal = () => {
    if (!cartTotal) return;
    
    const shippingCost = selectedShipping?.rate || 0;
    const taxAmount = taxCalculation?.stateTaxAmount || 0;
    const newTotal = cartTotal + shippingCost + taxAmount;
    
    setTotalWithShipping(newTotal);
    sessionStorage.setItem('checkout.calculatedTotal', newTotal.toString());
  };

  // Update total when shipping or tax changes
  useEffect(() => {
    recalculateTotal();
  }, [selectedShipping, taxCalculation, cartTotal]);

  // Check if cart is loaded and has items
  useEffect(() => {
    if (!cartLoading && (!items || items.length === 0)) {
      console.log('No items in cart, redirecting to cart page');
      router.push('/cart');
    }
  }, [cartLoading, items, router]);

  // Add effect to sync billing address when sameAsShipping changes
  useEffect(() => {
    if (sameAsShipping) {
      // Convert shipping address to billing address format
      const billingAddressData: BillingAddress = {
        name: shippingAddress.name || '',
        email: shippingAddress.email || '',
        street: shippingAddress.street || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        postalCode: shippingAddress.postalCode || '',
        country: shippingAddress.country || '',
        phone: shippingAddress.phone || '',
        type: 'BILLING'
      };
      setBillingAddress(billingAddressData);
    }
  }, [sameAsShipping, shippingAddress]);

  // Add effect to save data to session storage
  useEffect(() => {
    if (!isAddressComplete || !selectedShipping || !taxCalculation) {
      console.log('Not saving to session storage:', {
        isAddressComplete,
        hasSelectedShipping,
        hasTaxCalculation,
      });
      return;
    }

    try {
      // Ensure shipping rate is properly formatted
      const shippingRate: ShippingRate = {
        id: selectedShipping.id,
        name: selectedShipping.name,
        rate: Number(selectedShipping.rate),
        description: selectedShipping.description,
        estimatedDays: selectedShipping.estimatedDays
      };

      const storageValues = {
        'checkout.shippingAddress': shippingAddress,
        'checkout.billingAddress': billingAddress,
        'checkout.shippingRate': shippingRate,
        'checkout.taxAmount': taxCalculation.stateTaxAmount,
        'checkout.calculatedTotal': totalWithShipping,
        'checkout.items': items
      };

      // Log what we're saving
      console.log('Saving to session storage:', storageValues);

      // Save all values
      Object.entries(storageValues).forEach(([key, value]) => {
        safeSessionStorage.set(key, value);
      });

      // Verify the data was saved correctly
      const savedShippingRate = safeSessionStorage.get('checkout.shippingRate');
      console.log('Verified saved shipping rate:', savedShippingRate);
    } catch (err) {
      console.error('Error saving to session storage:', err);
    }
  }, [isAddressComplete, selectedShipping, taxCalculation, shippingAddress, billingAddress, totalWithShipping, items]);

  // Update the handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddressComplete || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Save shipping address and rate to session storage
      const shippingData = {
        address: shippingAddress,
        rate: selectedShipping,
        tax: taxCalculation
      };
      
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('shippingData', JSON.stringify(shippingData));
      }

      // Navigate to payment page
      router.push('/checkout/payment');
    } catch (err) {
      console.error('Error saving shipping data:', err);
      setError('Failed to save shipping information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch address book for logged-in users
  useEffect(() => {
    if (isLoggedIn) {
      setAddressBookLoading(true)
      setAddressSaved(false)
      fetch('/api/user/addresses')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAddressBook(data)
          setAddressBookLoading(false)
        })
        .catch(err => {
          setAddressBookError('Failed to load saved addresses')
          setAddressBookLoading(false)
        })
    }
  }, [isLoggedIn])

  // When a saved address is selected, prefill the form
  useEffect(() => {
    if (selectedAddressId && addressBook.length > 0) {
      const addr = addressBook.find(a => a.id === selectedAddressId)
      if (addr) setShippingAddress(addr as ShippingAddress)
    }
  }, [selectedAddressId, addressBook])

  // Defensive: track loading/error for both shipping and tax
  const isShippingReady = useCallback(() => {
    if (shippingLoading) return false
    if (shippingError) return false
    if (shippingOptions.length === 0) return false
    if (!selectedShipping) return false
    return true
  }, [shippingLoading, shippingError, shippingOptions.length, selectedShipping])

  // Add logging for debugging
  useEffect(() => {
    if (shippingError) {
      console.error('Shipping error:', shippingError);
    }
    if (!isShippingReady()) {
      console.warn('Shipping not ready:', { 
        hasOptions: shippingOptions.length > 0,
        hasSelectedShipping: !!selectedShipping,
        selectedShipping,
        shippingOptions 
      });
    }
  }, [shippingError, isShippingReady, shippingOptions, selectedShipping]);

  // Add effect to load saved shipping data
  useEffect(() => {
    if (!cartLoading && items.length > 0) {
      const savedOptions = safeSessionStorage.get('checkout.shippingOptions');
      const savedRate = safeSessionStorage.get('checkout.selectedShipping');
      
      if (savedOptions) {
        setShippingOptions(savedOptions);
      }
      
      if (savedRate) {
        setSelectedShipping(savedRate);
        setHasSelectedShipping(true);
      }
    }
  }, [cartLoading, items]);

  // Add effect to save checkout state
  useEffect(() => {
    if (!isAddressComplete || !hasSelectedShipping) {
      return;
    }

    try {
      const checkoutState = {
        shippingAddress,
        billingAddress,
        selectedShipping,
        taxCalculation,
        totalWithShipping
      };
      
      safeSessionStorage.set('checkout.state', checkoutState);
    } catch (err) {
      console.error('Error saving checkout state:', err);
    }
  }, [isAddressComplete, hasSelectedShipping, shippingAddress, billingAddress, selectedShipping, taxCalculation, totalWithShipping]);

  // Render cart items
  const renderCartItems = () => {
    return items.map((item: CartCartItem | ProductCartItem) => {
      const itemName = 'product' in item ? item.product?.name : item.name;
      const itemImage = 'product' in item ? item.product?.images?.[0] : item.image;
      const currentPrice = getItemPrice(item);
      const originalPrice = getOriginalPrice(item);
      const variantName = 'variant' in item ? item.variant?.name : undefined;
      const hasDiscount = originalPrice > currentPrice;
      
      return (
        <div key={`${item.productId}-${item.variantId || ''}`} className="flex items-center space-x-4 py-4">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
            <img
              src={itemImage || 'https://placehold.co/400x400?text=No+Image'}
              alt={itemName || 'Product'}
              className="h-full w-full object-cover object-center"
            />
          </div>
          <div className="flex flex-1 flex-col">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                {itemName || 'Product'}
                {variantName && ` - ${variantName}`}
              </h3>
            </div>
            <div className="mt-1 flex text-sm text-gray-500">
              <p>Qty {item.quantity}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {hasDiscount ? (
              <>
                <span className="text-sm line-through text-gray-500">
                  ${(originalPrice * item.quantity).toFixed(2)}
                </span>
                <span className="text-sm font-medium text-red-600">
                  ${(currentPrice * item.quantity).toFixed(2)}
                </span>
              </>
            ) : (
              <p className="text-sm font-medium text-gray-900">
                ${(currentPrice * item.quantity).toFixed(2)}
              </p>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left column - Address forms */}
            <div className="space-y-8">
              {/* Shipping Address */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="shipping-name" className="block text-sm font-medium text-gray-700">Full Name</label>
                      <input
                        id="shipping-name"
                        type="text"
                        value={shippingAddress.name}
                        onChange={(e) => handleAddressChange('shipping', 'name', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="shipping-email" className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        id="shipping-email"
                        type="email"
                        value={shippingAddress.email}
                        onChange={(e) => handleAddressChange('shipping', 'email', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="shipping-street" className="block text-sm font-medium text-gray-700">Street Address</label>
                      <input
                        id="shipping-street"
                        type="text"
                        value={shippingAddress.street}
                        onChange={(e) => handleAddressChange('shipping', 'street', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="shipping-city" className="block text-sm font-medium text-gray-700">City</label>
                        <input
                          id="shipping-city"
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => handleAddressChange('shipping', 'city', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="shipping-state" className="block text-sm font-medium text-gray-700">State</label>
                        <select
                          id="shipping-state"
                          value={shippingAddress.state}
                          onChange={(e) => handleAddressChange('shipping', 'state', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        >
                          <option value="">Select State</option>
                          {US_STATES.map((state) => (
                            <option key={state.code} value={state.code}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="shipping-postal" className="block text-sm font-medium text-gray-700">ZIP Code</label>
                      <input
                        id="shipping-postal"
                        type="text"
                        value={shippingAddress.postalCode}
                        onChange={(e) => handleAddressChange('shipping', 'postalCode', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="shipping-phone" className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        id="shipping-phone"
                        type="text"
                        value={shippingAddress.phone}
                        onChange={(e) => handleAddressChange('shipping', 'phone', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card>
                <CardHeader>
                  <CardTitle>Billing Address</CardTitle>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="same-as-shipping"
                      checked={sameAsShipping}
                      onChange={(e) => setSameAsShipping(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="same-as-shipping" className="text-sm text-gray-600">
                      Same as shipping address
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  {!sameAsShipping && (
                    <div className="space-y-4">
                      {/* Billing address fields (same structure as shipping) */}
                      <div>
                        <label htmlFor="billing-name" className="block text-sm font-medium text-gray-700">Full Name</label>
                        <input
                          id="billing-name"
                          type="text"
                          value={billingAddress.name}
                          onChange={(e) => handleAddressChange('billing', 'name', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="billing-email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          id="billing-email"
                          type="email"
                          value={billingAddress.email}
                          onChange={(e) => handleAddressChange('billing', 'email', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="billing-street" className="block text-sm font-medium text-gray-700">Street Address</label>
                        <input
                          id="billing-street"
                          type="text"
                          value={billingAddress.street}
                          onChange={(e) => handleAddressChange('billing', 'street', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="billing-city" className="block text-sm font-medium text-gray-700">City</label>
                          <input
                            id="billing-city"
                            type="text"
                            value={billingAddress.city}
                            onChange={(e) => handleAddressChange('billing', 'city', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="billing-state" className="block text-sm font-medium text-gray-700">State</label>
                          <select
                            id="billing-state"
                            value={billingAddress.state}
                            onChange={(e) => handleAddressChange('billing', 'state', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                          >
                            <option value="">Select State</option>
                            {US_STATES.map((state) => (
                              <option key={state.code} value={state.code}>
                                {state.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="billing-postal" className="block text-sm font-medium text-gray-700">ZIP Code</label>
                        <input
                          id="billing-postal"
                          type="text"
                          value={billingAddress.postalCode}
                          onChange={(e) => handleAddressChange('billing', 'postalCode', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="billing-phone" className="block text-sm font-medium text-gray-700">Phone</label>
                        <input
                          id="billing-phone"
                          type="text"
                          value={billingAddress.phone}
                          onChange={(e) => handleAddressChange('billing', 'phone', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column - Order summary */}
            <div className="space-y-8">
              {/* Order Summary */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
                <div className="space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-2">
                    {renderCartItems()}
                  </div>

                  {/* Shipping Method Selection */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium mb-2">Shipping Method (Optional)</h3>
                    {shippingLoading ? (
                      <div className="text-sm text-gray-500">Calculating shipping options...</div>
                    ) : shippingError ? (
                      <div className="text-sm text-red-500">{shippingError}</div>
                    ) : shippingOptions.length > 0 ? (
                      <div className="space-y-2">
                        {shippingOptions.map((option) => (
                          <label
                            key={option.name}
                            className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                              selectedShipping?.name === option.name
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                            onClick={() => handleShippingRateSelect(option)}
                          >
                            <div>
                              <span className="font-medium">{option.name}</span>
                              {option.rate === 0 && <span className="ml-2 text-green-600">(Free)</span>}
                            </div>
                            <div>
                              {option.rate > 0 ? `$${option.rate.toFixed(2)}` : 'Free'}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No shipping options available</div>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>{selectedShipping ? `$${selectedShipping.rate.toFixed(2)}` : 'Free'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>{taxCalculation ? `$${taxCalculation.stateTaxAmount.toFixed(2)}` : 'Calculating...'}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>${totalWithShipping.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Continue to Payment Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !isAddressComplete}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Continue to Payment'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}