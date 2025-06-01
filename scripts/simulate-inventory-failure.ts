import { prisma } from '../lib/db';

async function simulateInventoryFailure(orderId: string) {
  if (!orderId) {
    console.error('Usage: ts-node scripts/simulate-inventory-failure.ts <orderId>');
    process.exit(1);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  if (!order) {
    console.error('Order not found:', orderId);
    process.exit(1);
  }

  for (const item of order.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: 0 }
    });
    if (item.variantId) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: 0 }
      });
    }
    console.log(`Set stock to 0 for product ${item.productId}${item.variantId ? ` (variant ${item.variantId})` : ''}`);
  }

  console.log('Inventory failure simulated. Now complete payment for this order to test webhook error handling.');
  process.exit(0);
}

// Run the script with the provided orderId
const orderId = process.argv[2];
simulateInventoryFailure(orderId); 