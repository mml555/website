import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { decimalToNumber } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';
import { CartProvider } from '@/lib/cart';
beforeAll(() => {
    global.fetch = jest.fn(() => Promise.resolve({
        json: () => Promise.resolve({ stock: 10, name: 'Test Product' }),
        ok: true,
    }));
});
afterAll(() => {
    jest.resetAllMocks();
});
describe('Product Utilities', () => {
    describe('decimalToNumber', () => {
        it('handles number input', () => {
            expect(decimalToNumber(10.99)).toBe(10.99);
        });
        it('handles string input', () => {
            expect(decimalToNumber('10.99')).toBe(10.99);
        });
        it('handles null input', () => {
            expect(decimalToNumber(null)).toBe(0);
        });
        it('handles undefined input', () => {
            expect(decimalToNumber(undefined)).toBe(0);
        });
        it('returns 0 for non-numeric string', () => {
            expect(decimalToNumber('not-a-number')).toBe(0);
        });
    });
});
describe('Product Component', () => {
    const mockProduct = {
        id: '1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        variants: [],
        images: ['https://example.com/test-image.jpg'],
        image: 'https://example.com/test-image.jpg',
        categoryId: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    it('renders product information correctly', () => {
        render(<CartProvider>
        <ProductCard product={mockProduct} index={0}/>
      </CartProvider>);
        expect(screen.getByText('Test Product')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
        expect(screen.getByText('$99.99')).toBeInTheDocument();
    });
    it('handles add to cart action', async () => {
        render(<CartProvider>
        <ProductCard product={mockProduct} index={0}/>
      </CartProvider>);
        const addToCartButton = screen.getByRole('button', { name: /add to cart/i });
        await act(async () => {
            fireEvent.click(addToCartButton);
        });
        expect(addToCartButton).toBeInTheDocument();
    });
});
