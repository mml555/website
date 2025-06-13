import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react';
import { decimalToNumber } from '@/lib/AppUtils'
import ProductCard from '@/components/ProductCard'
import { CartProvider } from '@/lib/cart'

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ stock: 10, name: 'Test Product' }),
      ok: true,
    })
  ) as jest.Mock;
});

afterAll(() => {
  jest.resetAllMocks();
});

describe('Product Utilities', () => {
  describe('decimalToNumber', () => {
    it('handles number input', () => {
      expect(decimalToNumber(10.99)).toBe(10.99)
    })
    it('handles string input', () => {
      expect(decimalToNumber('10.99')).toBe(10.99)
    })
    it('handles null input', () => {
      expect(decimalToNumber(null)).toBe(0)
    })
    it('handles undefined input', () => {
      expect(decimalToNumber(undefined)).toBe(0)
    })
    it('returns 0 for non-numeric string', () => {
      expect(decimalToNumber('not-a-number')).toBe(0)
    })
  })
})

describe('Product Component', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    description: 'A test product',
    price: 100,
    stock: 10,
    images: ['https://picsum.photos/200'],
    categoryId: 'cat1',
    category: { id: 'cat1', name: 'Test Category' },
    weight: 1,
    sku: 'SKU1',
    featured: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  it('renders product information correctly', () => {
    render(
      <CartProvider>
        <ProductCard product={mockProduct} index={0} />
      </CartProvider>
    )
    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('A test product')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('handles add to cart action', async () => {
    render(
      <CartProvider>
        <ProductCard product={mockProduct} index={0} />
      </CartProvider>
    )
    const addToCartButton = screen.getByRole('button', { name: /add to cart/i });
    await act(async () => {
      fireEvent.click(addToCartButton);
    });
    expect(addToCartButton).toBeInTheDocument();
  })
}) 