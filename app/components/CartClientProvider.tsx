'use client'

import * as CartModule from '../../lib/cart'

const RealCartProvider = (CartModule as any).CartProvider as React.FC<{children: React.ReactNode}>

export default function CartClientProvider({ children }: { children: React.ReactNode }) {
  return <RealCartProvider>{children}</RealCartProvider>
} 