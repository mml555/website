import { prisma } from '@/lib/prisma'
import { userAddressSchema } from '@/lib/validations/schemas'

export async function listUserAddresses(userId: string) {
  return prisma.userAddress.findMany({ where: { userId } })
}

export async function createUserAddress(userId: string, data: any) {
  const parse = userAddressSchema.safeParse(data)
  if (!parse.success) {
    throw new Error('Invalid address data')
  }

  const addressData = {
    ...parse.data,
    userId,
    email: parse.data.email || '',
  }

  return prisma.userAddress.create({ data: addressData })
}

export async function updateUserAddress(userId: string, data: any) {
  if (!data.id) throw new Error('Address id required')
  const parse = userAddressSchema.safeParse(data)
  if (!parse.success) {
    throw new Error('Invalid address')
  }
  return prisma.userAddress.update({ where: { id: data.id, userId }, data: parse.data })
}

export async function deleteUserAddress(userId: string, id: string) {
  if (!id) throw new Error('Address id required')
  return prisma.userAddress.delete({ where: { id, userId } })
} 