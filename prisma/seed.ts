import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { faker } from '@faker-js/faker'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()
const FALLBACK_IMAGE = 'https://picsum.photos/seed/default/400/400'

// Helper function to hash password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function main() {
  // Create test categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Electronics',
        description: 'Electronic devices and accessories'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Clothing',
        description: 'Apparel and fashion items'
      }
    }),
    prisma.category.create({
      data: {
        name: 'Home & Garden',
        description: 'Home decor and garden supplies'
      }
    })
  ])

  // Create test products
  const products = await Promise.all([
    // Electronics
    prisma.product.create({
      data: {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 199.99,
        stock: 50,
        images: ['https://picsum.photos/400/400'],
        categoryId: categories[0].id,
        sku: 'WH-001',
        isActive: true,
        featured: true,
        weight: 0.5
      }
    }),
    prisma.product.create({
      data: {
        name: 'Smart Watch',
        description: 'Feature-rich smartwatch with health tracking',
        price: 299.99,
        stock: 30,
        images: ['https://picsum.photos/400/400'],
        categoryId: categories[0].id,
        sku: 'SW-001',
        isActive: true,
        featured: true,
        weight: 0.3
      }
    }),
    // Clothing
    prisma.product.create({
      data: {
        name: 'Cotton T-Shirt',
        description: 'Comfortable cotton t-shirt for everyday wear',
        price: 29.99,
        stock: 100,
        images: ['https://picsum.photos/400/400'],
        categoryId: categories[1].id,
        sku: 'TS-001',
        isActive: true,
        featured: false,
        weight: 0.2
      }
    }),
    prisma.product.create({
      data: {
        name: 'Denim Jeans',
        description: 'Classic denim jeans with modern fit',
        price: 79.99,
        stock: 75,
        images: ['https://picsum.photos/400/400'],
        categoryId: categories[1].id,
        sku: 'DJ-001',
        isActive: true,
        featured: true,
        weight: 0.8
      }
    }),
    // Home & Garden
    prisma.product.create({
      data: {
        name: 'Indoor Plant',
        description: 'Beautiful indoor plant for home decoration',
        price: 39.99,
        stock: 40,
        images: ['https://picsum.photos/400/400'],
        categoryId: categories[2].id,
        sku: 'IP-001',
        isActive: true,
        featured: false,
        weight: 1.5
      }
    }),
    prisma.product.create({
      data: {
        name: 'Garden Tools Set',
        description: 'Complete set of essential garden tools',
        price: 89.99,
        stock: 25,
        images: ['https://picsum.photos/400/400'],
        categoryId: categories[2].id,
        sku: 'GT-001',
        isActive: true,
        featured: true,
        weight: 2.0
      }
    })
  ])

  // Create test admin user
  const adminPassword = await hash('admin123', 12)
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN'
    }
  })

  console.log('Seed data created successfully!')
  console.log('Categories:', categories.length)
  console.log('Products:', products.length)

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
        price: Math.floor(Math.random() * 10000) / 100, // Random price between 0 and 100
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
    const order = await prisma.order.create({
      data: {
        status: 'PENDING',
        total: 99.99,
        orderNumber: `ORDER-${i}`,
        shippingAddress: {
          create: {
            name: 'John Doe',
            email: 'john@example.com',
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'USA',
            phone: '123-456-7890'
          }
        },
        billingAddress: {
          create: {
            name: 'John Doe',
            email: 'john@example.com',
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'USA',
            phone: '123-456-7890'
          }
        }
      },
    })

    // Create order items after order is created
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        quantity: 1,
        price: product.price,
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
  const productsToUpdate = await prisma.product.findMany()
  for (const product of productsToUpdate) {
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