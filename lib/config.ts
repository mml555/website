// NOTE: If you add any server-only values here, do NOT import this file in client components.
// Only use NEXT_PUBLIC_* and NODE_ENV for client-safe config.

export const config = {
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    // Add more Stripe-related config here
  },
  environment: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    // Add more environment-specific settings here
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    // Add more API-related config here
  }
} as const;

// Type for the config object
export type Config = typeof config;

// Helper function to get config value
export function getConfig<T extends keyof Config>(key: T): Config[T] {
  return config[key];
} 