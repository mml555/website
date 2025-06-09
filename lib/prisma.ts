// NOTE: This file is server-only. Do NOT import in client components.
import { PrismaClient } from '@prisma/client'
import { nodeEnv } from './env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

if (nodeEnv !== 'production') globalForPrisma.prisma = prisma 