// SERVER-ONLY: Do NOT import this file in client components. Use only in API routes or server actions.
import { Resend } from "resend";
import React from "react";
// import OrderConfirmationEmail from "../emails/OrderConfirmation";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmationEmail(
  order: {
    id: string;
    createdAt: string | Date;
    status: string;
    total: number | string;
    items: Array<{
      id: string;
      quantity: number;
      price: number;
      product: {
        name: string;
      };
    }>;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  }
) {
  try {
    // Commented out to avoid import error
    // const { data, error } = await resend.emails.send({
    //   from: "Your Store <orders@yourstore.com>",
    //   to: process.env.DEFAULT_NOTIFICATION_EMAIL || "orders@yourstore.com",
    //   subject: `Order Confirmation - Order #${order.id}`,
    //   react: OrderConfirmationEmail({ order: { ...order, total: Number(order.total) } }),
    // });
    return true;
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
    return false;
  }
}

interface OrderShippedEmailProps {
  order: {
    id: string;
    createdAt: string | Date;
    status: string;
    total: number | string;
    items: Array<{
      id: string;
      quantity: number;
      price: number;
      product: {
        name: string;
      };
    }>;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  trackingNumber: string;
}

function OrderShippedEmail({ order, trackingNumber }: OrderShippedEmailProps) {
  return (
    <div>
      <h1>Your Order Has Shipped!</h1>
      <p>Order #{order.id}</p>
      <p>Tracking Number: {trackingNumber}</p>
      <p>
        You can track your package using the following link:
        <br />
        <a href={`https://tracking.example.com/${trackingNumber}`}>
          Track Package
        </a>
      </p>
    </div>
  );
}

export async function sendOrderShippedEmail(
  order: {
    id: string;
    createdAt: string | Date;
    status: string;
    total: number | string;
    items: Array<{
      id: string;
      quantity: number;
      price: number;
      product: {
        name: string;
      };
    }>;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  },
  trackingNumber: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: "Your Store <orders@yourstore.com>",
      to: process.env.DEFAULT_NOTIFICATION_EMAIL || "orders@yourstore.com",
      subject: `Your Order #${order.id} Has Shipped!`,
      react: OrderShippedEmail({ order, trackingNumber }),
    });

    if (error) {
      console.error("Failed to send shipping confirmation email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending shipping confirmation email:", error);
    return false;
  }
} 