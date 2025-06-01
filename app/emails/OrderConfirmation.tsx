import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface OrderConfirmationEmailProps {
  order: {
    id: string;
    createdAt: string | Date;
    status: string;
    total: number;
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
}

export default function OrderConfirmationEmail({
  order,
}: OrderConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Order Confirmation - Order #{order.id}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Order Confirmation</Heading>
          <Text style={text}>
            Thank you for your order! We&apos;re excited to let you know that we&apos;ve
            received your order and it is now being processed.
          </Text>

          <Section style={section}>
            <Text style={text}>
              <strong>Order Number:</strong> {order.id}
            </Text>
            <Text style={text}>
              <strong>Order Date:</strong>{" "}
              {new Date(order.createdAt).toLocaleDateString()}
            </Text>
            <Text style={text}>
              <strong>Order Status:</strong> {order.status}
            </Text>
          </Section>

          <Section style={section}>
            <Text style={text}>
              <strong>Shipping Address:</strong>
            </Text>
            <Text style={text}>
              {order.shippingAddress.street}
            </Text>
            <Text style={text}>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </Text>
            <Text style={text}>
              {order.shippingAddress.country}
            </Text>
          </Section>

          <Section style={section}>
            <Text style={text}>
              <strong>Order Items:</strong>
            </Text>
            {order.items.map((item: any) => (
              <Section key={item.id} style={itemStyle}>
                <Text style={text}>{item.product.name}</Text>
                <Text style={text}>Quantity: {item.quantity}</Text>
                <Text style={text}>Price: ${item.price.toString()}</Text>
              </Section>
            ))}
            <Text style={text}>
              <strong>Total:</strong> ${order.total.toFixed(2)}
            </Text>
          </Section>

          <Section style={section}>
            <Text style={text}>
              We&apos;ll send you another email when your order ships with tracking
              information.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
}

const section = {
  padding: "24px",
  backgroundColor: "#f6f9fc",
  borderRadius: "5px",
  marginTop: "20px",
}

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
}

const text = {
  color: "#333",
  fontSize: "16px",
  margin: "8px 0",
}

const itemStyle = {
  padding: "8px 0",
} 