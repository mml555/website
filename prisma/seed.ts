import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { faker } from '@faker-js/faker'

const prisma = new PrismaClient()
const FALLBACK_IMAGE = 'https://picsum.photos/seed/default/400/400'

// Helper function to hash password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function main() {
  // Create a real user
  const user = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      name: 'Test Customer',
      email: 'customer@example.com',
      password: null,
      role: 'USER',
    },
  })

  // Ensure at least one category exists
  const category = await prisma.category.upsert({
    where: { name: 'Sample Category' },
    update: {},
    create: {
      name: 'Sample Category',
      description: 'A category for sample products',
    },
  })

  // Add 50 sample products
  for (let i = 1; i <= 50; i++) {
    const imageUrl = `https://picsum.photos/seed/${i}/400/400`
    await prisma.product.create({
      data: {
        name: `Sample Product ${i}`,
        description: `This is the description for Sample Product ${i}.`,
        price: Math.floor(Math.random() * 10000) / 100,
        stock: Math.floor(Math.random() * 100) + 1, // Random stock between 1 and 100
        categoryId: category.id,
        images: [imageUrl],
      },
    })
  }

  // Get a product to use in orders
  const product = await prisma.product.findFirst()
  if (!product) {
    throw new Error('No products found. Seed products first.')
  }

  // Create orders for the real user
  for (let i = 0; i < 3; i++) {
    await prisma.order.create({
      data: {
        orderNumber: `SEED-${Date.now()}-${i}`,
        userId: user.id,
        status: 'PENDING',
        total: product.price,
        items: {
          create: [{
            productId: product.id,
            quantity: 1,
            price: product.price,
          }],
        },
        shippingAddress: {
          create: {
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state(),
            postalCode: faker.location.zipCode(),
            country: faker.location.country(),
          },
        },
      },
    })
  }

  // Create guest user
  const guestUser = await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      name: 'Guest User',
      role: 'USER',
    },
  })

  console.log('Seeded real user and orders.')
  console.log('Guest user created:', guestUser)

  // Backfill images field for all products
  const products = await prisma.product.findMany()
  for (const product of products) {
    let newImages: string[] = []
    if (Array.isArray(product.images) && product.images.length > 0) {
      newImages = product.images.filter((img: string) => typeof img === 'string' && img.length > 0)
    } else {
      newImages = [FALLBACK_IMAGE]
    }
    // Only update if needed
    if (
      !Array.isArray(product.images) ||
      product.images.length !== newImages.length ||
      product.images.some((img: string, i: number) => img !== newImages[i])
    ) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: newImages },
      })
      console.log(`Updated product ${product.id} with images:`, newImages)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 