// import { prisma } from '../lib/db';
import { prisma } from '../lib/prisma';
import fetch from 'node-fetch';

async function main() {
  // 1. Create a test product with 0 stock
  const testProduct = await prisma.product.create({
    data: {
      name: 'Test Out of Stock Product',
      price: 100,
      stock: 0,
      description: 'This product is out of stock for testing.'
    },
  });

  // 2. Attempt to create a payment intent with this product
  const response = await fetch('http://localhost:3000/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          productId: testProduct.id,
          quantity: 1,
          price: 100,
        },
      ],
      total: 100,
    }),
  });

  const data = await response.json();
  console.log('API response:', data);

  // 3. Clean up: delete the test product
  await prisma.product.delete({ where: { id: testProduct.id } });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 