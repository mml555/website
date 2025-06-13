import { NextAuthOptions } from 'next-auth'
import { prisma } from './prisma'
import { rateLimit } from './rate-limit'
import { logger } from './logger'
import { monitoring } from './monitoring'
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import EmailProvider from "next-auth/providers/email"
import { sendVerificationRequest } from "@/lib/email"

// Validate environment variables
function validateEnv() {
  const required = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL']
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

validateEnv()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true
          }
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      sendVerificationRequest,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        await monitoring.measureAsync('auth_sign_in', async () => {
          await rateLimit.check(5, user.id) // 5 attempts per minute
        }, { userId: user.id })
      } catch (error) {
        logger.error('Rate limit exceeded for sign in', { userId: user.id, error })
        throw error
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, metadata) {
      const errorMessage = metadata instanceof Error 
        ? metadata.message 
        : typeof metadata === 'object' 
          ? JSON.stringify(metadata, null, 2)
          : String(metadata);
      logger.error({ code, error: errorMessage }, 'NextAuth error');
    },
    warn(code) {
      logger.warn({ code }, 'NextAuth warning');
    },
    debug(code, metadata) {
      const debugMessage = typeof metadata === 'object'
        ? JSON.stringify(metadata, null, 2)
        : String(metadata);
      logger.debug({ code, details: debugMessage }, 'NextAuth debug');
    },
  }
} 