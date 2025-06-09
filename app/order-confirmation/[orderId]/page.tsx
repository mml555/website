import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OrderConfirmationClient } from './OrderConfirmationClient';
import { getOrder } from '@/lib/orders';

export default async function OrderConfirmationPage({
  params,
}: {
  params: { orderId: string };
}) {
  try {
    console.log('Server  Processing order ID:', params.orderId);
    
    // Get the order from the database first
    const order = await getOrder(params.orderId);
    console.log('Server  Order from database:', order);

    if (!order) {
      console.log('Server  No order found in database');
      redirect('/');
    }

    // Get the order cookie
    const cookieStore = cookies();
    const orderCookie = cookieStore.get('order');
    console.log('Server  Order cookie:', orderCookie?.value);

    // If no order cookie, redirect to home
    if (!orderCookie?.value) {
      console.log('Server  No order cookie found');
      redirect('/');
    }

    // Parse the order cookie
    const orderData = JSON.parse(orderCookie.value);
    console.log('Server  Order data from cookie:', orderData);

    // Verify the order ID matches
    if (orderData.id !== params.orderId) {
      console.log('Server  Order ID mismatch');
      redirect('/');
    }

    return <OrderConfirmationClient order={order} />;
  } catch (error) {
    console.error('Server  Error in OrderConfirmationPage:', error);
    redirect('/');
  }
} 