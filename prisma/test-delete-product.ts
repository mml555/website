import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testProductDeletion() {
  try {
    // First, create a test product
    console.log('Creating test product...')
    const product = await prisma.product.create({
      data: {
        name: `Test Product ${Date.now()}`,
        description: 'Test product for deletion',
        price: 9.99,
        stock: 10,
        images: ['https://picsum.photos/seed/test/400/400']
      }
    })
    console.log('Test product created:', product)

    // Try to delete the product
    console.log('\nAttempting to delete product...')
    await prisma.product.delete({
      where: { id: product.id }
    })
    console.log('Product successfully deleted')

    // Verify deletion
    const deletedProduct = await prisma.product.findUnique({
      where: { id: product.id }
    })
    console.log('\nVerification:', {
      productStillExists: !!deletedProduct
    })

  } catch (error) {
    console.error('Error during product deletion test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProductDeletion() 