export interface Address {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BillingAddress {
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