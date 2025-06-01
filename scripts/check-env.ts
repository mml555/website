import { config } from 'dotenv'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'

// Load environment variables from .env files
const loadEnv = () => {
  const envPath = path.resolve(process.cwd(), '.env')
  const envLocalPath = path.resolve(process.cwd(), '.env.local')
  const envProductionPath = path.resolve(process.cwd(), '.env.production')
  
  // Load base .env
  if (fs.existsSync(envPath)) {
    config({ path: envPath })
  }
  
  // Load .env.local if it exists
  if (fs.existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: true })
  }
  
  // Load .env.production if it exists
  if (fs.existsSync(envProductionPath)) {
    config({ path: envProductionPath, override: true })
  }
}

// Environment variable schemas
const requiredEnvSchema = z.object({
  // Required in all environments
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  
  // Required in production
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

const developmentEnvSchema = z.object({
  // Optional in development
  NEXTAUTH_URL: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
})

// Check environment variables
function checkEnv() {
  loadEnv()
  
  const isProduction = process.env.NODE_ENV === 'production'
  const schema = isProduction ? requiredEnvSchema : developmentEnvSchema
  
  try {
    schema.parse(process.env)
    console.log('✅ Environment variables are valid')
    return true
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variables validation failed:')
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
    } else {
      console.error('❌ Unexpected error during environment validation:', error)
    }
    return false
  }
}

// Run the check
const isValid = checkEnv()
process.exit(isValid ? 0 : 1) 