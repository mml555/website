'use client';

import { Suspense } from 'react';
import ProductsPage from './ProductsPage';

export default function ProductsPageWithSuspense() {
  return (
    <Suspense fallback={<div>Loading products...</div>}>
      <ProductsPage />
    </Suspense>
  );
} 