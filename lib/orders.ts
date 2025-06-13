import type { Order } from '@/types/order';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    logger.info('Fetching order:', { orderId });
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                images: true,
              }
            },
            variant: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
      },
    });

    if (!order) {
      logger.info('Order not found:', { orderId });
      return null;
    }

    logger.info('Found order:', {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      itemsCount: order.items.length
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      tax: Number(order.tax),
      shippingRate: Number(order.shippingRate),
      items: order.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.price),
        variantId: item.variantId,
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          price: Number(item.product.price),
          images: item.product.images as string[],
        }
      })),
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      userId: order.userId,
      customerEmail: order.customerEmail,
      stripeSessionId: order.stripeSessionId,
      paymentIntentId: order.paymentIntentId,
    };
  } catch (error) {
    logger.error('Error getting order:', { error, orderId });
    return null;
  }
} 