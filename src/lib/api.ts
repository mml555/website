import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getProducts(params?: {
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
}) {
  try {
    const where = {
      isActive: params?.isActive,
      ...(params?.category && { categoryId: params.category }),
      ...(params?.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { description: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const products = await prisma.product.findMany({
      where,
      orderBy: params?.sort ? { [params.sort]: 'desc' } : { createdAt: 'desc' },
      skip: params?.page ? (params.page - 1) * (params.limit || 10) : 0,
      take: params?.limit || 10,
    });

    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
} 