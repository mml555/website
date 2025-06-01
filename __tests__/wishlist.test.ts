/**
 * @jest-environment node
 */
import { prisma } from '../lib/db'

describe('Wishlist functionality', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.wishlistItem.deleteMany({
      where: {
        user: { email: 'test@example.com' },
      },
    })
    await prisma.product.deleteMany({
      where: {
        name: 'Test Product',
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: 'test@example.com',
      },
    })
    await prisma.category.deleteMany({
      where: {
        name: 'Test Category',
      },
    })
  })

  it('should add and remove items from wishlist', async () => {
    // Create a test category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        description: 'A test category for wishlist testing',
      },
    })

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    })

    // Create a test product
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        description: 'A test product for wishlist testing',
        price: 99.99,
        categoryId: category.id,
      },
    })

    // Add product to wishlist
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId: user.id,
        productId: product.id,
      },
    })

    expect(wishlistItem).toBeDefined()
    expect(wishlistItem.userId).toBe(user.id)
    expect(wishlistItem.productId).toBe(product.id)

    // Get user's wishlist
    const wishlist = await prisma.wishlistItem.findMany({
      where: {
        userId: user.id,
      },
      include: {
        product: true,
      },
    })

    expect(wishlist).toHaveLength(1)
    expect(wishlist[0].product.id).toBe(product.id)

    // Remove from wishlist
    await prisma.wishlistItem.delete({
      where: {
        id: wishlistItem.id,
      },
    })

    const updatedWishlist = await prisma.wishlistItem.findMany({
      where: {
        userId: user.id,
      },
    })

    expect(updatedWishlist).toHaveLength(0)
  })
}) 