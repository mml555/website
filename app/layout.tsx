import type { Metadata, Viewport } from "next"
import "./globals.css"
import Navigation from "@/components/Navigation"
import Providers from "./providers"
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import CartClientProvider from './components/CartClientProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
}

const metadataBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: "E-commerce Store",
  description: "Your one-stop shop for all your needs",
  keywords: "e-commerce, online shopping, retail, products, deals, fashion, electronics, home goods",
  authors: [{ name: "Your Store Name" }],
  openGraph: {
    title: "E-commerce Store",
    description: "Discover amazing products with fast shipping and excellent customer service. Shop now for the best deals!",
    url: "https://your-store.com",
    siteName: "E-commerce Store",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "E-commerce Store Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "E-commerce Store",
    description: "Discover amazing products with fast shipping and excellent customer service. Shop now for the best deals!",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: "your-google-site-verification",
  },
  alternates: {
    canonical: 'https://your-store.com',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      {
        rel: 'android-chrome-192x192',
        url: '/icons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        rel: 'android-chrome-512x512',
        url: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'E-commerce Store'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <CartClientProvider>
            <Navigation />
            {children}
          </CartClientProvider>
        </Providers>
      </body>
    </html>
  )
} 