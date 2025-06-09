"use client"

import { SessionProvider } from "next-auth/react"
import CartClientProvider from "./components/CartClientProvider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartClientProvider>
        {children}
      </CartClientProvider>
    </SessionProvider>
  )
} 