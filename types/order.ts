export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  tax: number;
  shippingRate: number;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  createdAt: string;
  updatedAt: string;
  userId?: string | null;
  customerEmail?: string | null;
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  variantId?: string | null;
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    images: string[];
  };
}

export interface Address {
  id: string;
  orderId: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  price: number;
} 