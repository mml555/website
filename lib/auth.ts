import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import { JWT } from "next-auth/jwt"
import { Session } from "next-auth"
import bcrypt from "bcryptjs"
import { RateLimit } from "@/lib/rate-limit"
import { compare } from "bcryptjs"

// Create a rate limiter with more lenient limits
const loginLimiter = new RateLimit({
  interval: 15 * 60, // 15 minutes
  uniqueTokenPerInterval: 500
})

// Password validation
function validatePassword(password: string): boolean {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  )
}

// Helper function to hash password
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

// Helper function to verify password
async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// Validate environment variables
function validateEnv() {
  const requiredEnvVars = ['NEXTAUTH_URL', 'NEXTAUTH_SECRET']
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
  
  if (missingEnvVars.length > 0) {
    console.warn(`Missing required environment variables: ${missingEnvVars.join(', ')}`)
    console.warn('Please set these variables in your .env file')
  }
}

// Call validation on import
validateEnv()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter your email and password')
        }

        try {
          // Check rate limit
          try {
            await loginLimiter.check(10, credentials.email)
          } catch {
            throw new Error('Too many login attempts, please try again later')
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          })

          if (!user) {
            throw new Error('No user found with this email')
          }

          if (!user.password) {
            throw new Error('User does not have a password set')
          }
          const isPasswordValid = await compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            throw new Error('Invalid password')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        } catch (error) {
          console.error('Login error:', error)
          throw error
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login", // Redirect to login page on error
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-key-for-development",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          role: user.role,
        }
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token) {
        return {
          ...session,
          user: {
            ...session.user,
            id: token.id as string,
            role: token.role as "USER" | "ADMIN",
          },
        }
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-key-for-development",
  debug: false,
} 