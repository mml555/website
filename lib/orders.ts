import type { Order, OrderItem, Address, ShippingMethod } from '@/types/order';
import { prisma } from '@/lib/prisma';

export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
      },
    });

    if (!order) {
      return null;
    }

    // Calculate subtotal and tax
    const subtotal = order.items.reduce((sum, item) => {
      return sum + (Number(item.price) * item.quantity);
    }, 0);

    const tax = subtotal * 0.0825; // 8.25% tax rate

    const shippingMethod: ShippingMethod = {
      id: 'standard',
      name: 'Standard Shipping',
      price: 0, // Default shipping rate
    };

    const items: OrderItem[] = order.items.map(item => ({
      id: item.id,
      name: item.product.name,
      price: Number(item.price),
      quantity: item.quantity,
    }));

    const shippingAddress: Address = order.shippingAddress ? {
      name: order.customerEmail || '',
      street: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
    } : {
      name: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    };

    const billingAddress: Address = order.billingAddress ? {
      name: order.billingAddress.name,
      street: order.billingAddress.address,
      city: order.billingAddress.city,
      state: order.billingAddress.state,
      postalCode: order.billingAddress.zipCode,
      country: order.billingAddress.country || 'US',
    } : {
      name: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    };

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      subtotal,
      tax,
      items,
      shippingAddress,
      billingAddress,
      shippingMethod,
      createdAt: order.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
} 