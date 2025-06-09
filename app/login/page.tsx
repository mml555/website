"use client"

export const dynamic = 'force-dynamic'

import LoginPage from "./LoginPage"
import { Suspense } from "react"

export default function LoginPageWithSuspense() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
} 