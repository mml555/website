import { prisma } from '../lib/prisma';

async function resetInventoryForOrder(orderId: string, stock: number = 10) {
  if (!orderId) {
    console.error('Usage: ts-node scripts/reset-inventory-for-order.ts <orderId> [stock]');
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
      data: { stock }
    });
    if (item.variantId) {
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock }
      });
    }
    console.log(`Reset stock to ${stock} for product ${item.productId}${item.variantId ? ` (variant ${item.variantId})` : ''}`);
  }

  console.log('Inventory reset complete.');
  process.exit(0);
}

// Run the script with the provided orderId and optional stock value
const orderId = process.argv[2];
const stock = process.argv[3] ? parseInt(process.argv[3], 10) : 10;
resetInventoryForOrder(orderId, stock); 