import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setFeaturedProducts() {
  try {
    // Get the first 4 products and set them as featured
    const products = await prisma.product.findMany({
      take: 4,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Update each product to be featured
    for (const product of products) {
      await prisma.product.update({
        where: { id: product.id },
        data: { featured: true }
      });
    }

    console.log('Successfully set featured products');
  } catch (error) {
    console.error('Error setting featured products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setFeaturedProducts(); 