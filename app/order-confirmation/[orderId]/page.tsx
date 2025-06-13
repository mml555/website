import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrderConfirmationClient } from './OrderConfirmationClient';
import { logger } from '@/lib/logger';
import type { Order, OrderItem } from '@/types/order';

interface OrderConfirmationPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ payment_intent?: string }>;
}

interface DbOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: any; // Prisma Decimal
  variantId: string | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    price: any; // Prisma Decimal
    images: string[];
  };
}

async function clearServerCart(userId: string): Promise<void> {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId }
    });
    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      });
    }
  } catch (error) {
    logger.error('Error clearing cart:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: OrderConfirmationPageProps) {
  const session = await getServerSession(authOptions);
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const { orderId } = resolvedParams;
  const { payment_intent: paymentIntentId } = resolvedSearchParams;

  try {
    let order: Order | null = null;

    // If we have a payment intent ID, try to find the order by that first
    if (paymentIntentId) {
      const dbOrder = await prisma.order.findFirst({
        where: {
          paymentIntentId,
        },
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

      if (dbOrder) {
        // Convert Decimal objects to numbers
        order = {
          id: dbOrder.id,
          orderNumber: dbOrder.orderNumber,
          status: dbOrder.status,
          total: Number(dbOrder.total),
          tax: Number(dbOrder.tax),
          shippingRate: Number(dbOrder.shippingRate),
          items: dbOrder.items.map((item: DbOrderItem) => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.price),
            variantId: item.variantId,
            product: {
              id: item.product.id,
              name: item.product.name,
              description: item.product.description || '',
              price: Number(item.product.price),
              images: item.product.images,
            }
          })),
          shippingAddress: dbOrder.shippingAddress,
          billingAddress: dbOrder.billingAddress,
          createdAt: dbOrder.createdAt.toISOString(),
          updatedAt: dbOrder.updatedAt.toISOString(),
          userId: dbOrder.userId,
          customerEmail: dbOrder.customerEmail,
          stripeSessionId: dbOrder.stripeSessionId,
          paymentIntentId: dbOrder.paymentIntentId,
        };

        // If we found the order and the orderId is 'undefined' or doesn't match,
        // redirect to the correct URL
        if (orderId === 'undefined' || orderId !== dbOrder.id) {
          redirect(`/order-confirmation/${dbOrder.id}`);
        }
      }
    }

    // If we didn't find the order by payment intent or don't have a payment intent,
    // try to find it by orderId
    if (!order && orderId !== 'undefined') {
      const dbOrder = await prisma.order.findUnique({
        where: {
          id: orderId,
        },
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

      if (dbOrder) {
        // Convert Decimal objects to numbers
        order = {
          id: dbOrder.id,
          orderNumber: dbOrder.orderNumber,
          status: dbOrder.status,
          total: Number(dbOrder.total),
          tax: Number(dbOrder.tax),
          shippingRate: Number(dbOrder.shippingRate),
          items: dbOrder.items.map((item: DbOrderItem) => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.price),
            variantId: item.variantId,
            product: {
              id: item.product.id,
              name: item.product.name,
              description: item.product.description || '',
              price: Number(item.product.price),
              images: item.product.images,
            }
          })),
          shippingAddress: dbOrder.shippingAddress,
          billingAddress: dbOrder.billingAddress,
          createdAt: dbOrder.createdAt.toISOString(),
          updatedAt: dbOrder.updatedAt.toISOString(),
          userId: dbOrder.userId,
          customerEmail: dbOrder.customerEmail,
          stripeSessionId: dbOrder.stripeSessionId,
          paymentIntentId: dbOrder.paymentIntentId,
        };
      }
    }

    // If we still don't have an order, show the not found page
    if (!order) {
      logger.warn('Order not found:', { orderId, paymentIntentId });
      return (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Order Not Found</h1>
            <p className="text-muted-foreground mb-8">
              We couldn't find the order you're looking for.
            </p>
          </div>
        </div>
      );
    }

    // If order is pending and we have a payment intent, update the status
    if (order.status === 'PENDING' && paymentIntentId) {
      try {
        // Update order status to PAID
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: { status: 'PAID' },
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
          }
        });

        order = {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          total: Number(updatedOrder.total),
          tax: Number(updatedOrder.tax),
          shippingRate: Number(updatedOrder.shippingRate),
          items: updatedOrder.items.map((item: DbOrderItem): OrderItem => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.price),
            variantId: item.variantId,
            product: {
              id: item.product.id,
              name: item.product.name,
              description: item.product.description || '',
              price: Number(item.product.price),
              images: item.product.images as string[],
            }
          })),
          shippingAddress: updatedOrder.shippingAddress,
          billingAddress: updatedOrder.billingAddress,
          createdAt: updatedOrder.createdAt.toISOString(),
          updatedAt: updatedOrder.updatedAt.toISOString(),
          userId: updatedOrder.userId,
          customerEmail: updatedOrder.customerEmail,
          stripeSessionId: updatedOrder.stripeSessionId,
          paymentIntentId: updatedOrder.paymentIntentId,
        };
      } catch (error) {
        logger.error('Error updating order status:', error);
      }
    }

    // Clear the user's cart
    if (session?.user?.id) {
      await clearServerCart(session.user.id);
    }

    return <OrderConfirmationClient initialOrder={order} />;
  } catch (error) {
    // Don't log redirect errors as they are expected
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error;
    }
    
    logger.error('Error in order confirmation page:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-8">
            An error occurred while loading your order.
          </p>
        </div>
      </div>
    );
  }
} 