'use client'

import { CartProvider } from '../../lib/cart'

export default function CartClientProvider({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>
} 