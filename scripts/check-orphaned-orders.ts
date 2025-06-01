import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Find orders with missing users (orphaned orders)
  const orphanedOrders = await prisma.order.findMany({
    where: {
      userId: {
        not: null,
      },
      user: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  // 2. Find orders with NULL userId (guest orders)
  const guestOrders = await prisma.order.findMany({
    where: {
      userId: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  // 3. Count of orders with valid users (userId not null)
  const validOrdersCount = await prisma.order.count({
    where: {
      userId: {
        not: null,
      },
    },
  });

  console.log('--- Orphaned Orders (userId set but user missing) ---');
  if (orphanedOrders.length === 0) {
    console.log('None found.');
  } else {
    console.table(orphanedOrders);
  }

  console.log('\n--- Guest Orders (userId is NULL) ---');
  if (guestOrders.length === 0) {
    console.log('None found.');
  } else {
    console.table(guestOrders);
  }

  console.log(`\n--- Count of Orders with Valid Users: ${validOrdersCount} ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 