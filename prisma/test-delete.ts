import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDeletions() {
  try {
    // 1. First, let's find an order to delete
    const order = await prisma.order.findFirst({
      include: {
        items: true,
        shippingAddress: true,
        billingAddress: true
      }
    })

    if (!order) {
      console.log('No orders found to test deletion')
      return
    }

    console.log('Found order to delete:', {
      id: order.id,
      orderNumber: order.orderNumber,
      itemsCount: order.items.length,
      hasShippingAddress: !!order.shippingAddress,
      hasBillingAddress: !!order.billingAddress
    })

    // 2. Delete the order
    await prisma.order.delete({
      where: { id: order.id }
    })

    console.log('Successfully deleted order')

    // 3. Verify that related records were deleted
    const deletedOrder = await prisma.order.findUnique({
      where: { id: order.id }
    })
    const deletedItems = await prisma.orderItem.findMany({
      where: { orderId: order.id }
    })
    const deletedShippingAddress = await prisma.address.findUnique({
      where: { orderId: order.id }
    })
    const deletedBillingAddress = await prisma.billingAddress.findUnique({
      where: { orderId: order.id }
    })

    console.log('Verification results:', {
      orderExists: !!deletedOrder,
      itemsExist: deletedItems.length > 0,
      shippingAddressExists: !!deletedShippingAddress,
      billingAddressExists: !!deletedBillingAddress
    })

  } catch (error) {
    console.error('Error during deletion test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDeletions() 