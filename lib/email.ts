import nodemailer from "nodemailer"
import { createTransport } from 'nodemailer';
import { logger } from './logger';

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

// Send verification email
export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/verify-email?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Verify your email address",
    html: `
      <h1>Welcome to our platform!</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>If you did not create an account, you can safely ignore this email.</p>
    `,
  })
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/reset-password?token=${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Reset your password",
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  })
}

// Send order shipped email
export async function sendOrderShippedEmail(email: string, orderId: string) {
  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/orders/${orderId}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Your order has been shipped!",
    html: `
      <h1>Order Shipped</h1>
      <p>Your order (ID: ${orderId}) has been shipped and is on its way.</p>
      <p>You can track your order here:</p>
      <a href="${orderUrl}">${orderUrl}</a>
      <p>Thank you for shopping with us!</p>
    `,
  })
}

// Send admin notification email
export async function sendAdminEmail(subject: string, message: string) {
  const adminEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_FROM || 'admin@example.com';
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: adminEmail,
      subject,
      html: `<pre>${message}</pre>`
    });
    return true;
  } catch (error) {
    return false;
  }
}

interface SendVerificationRequestParams {
  identifier: string;
  url: string;
  provider: {
    server: {
      host: string;
      port: string;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
  };
}

export async function sendVerificationRequest({
  identifier: email,
  url,
  provider: { server, from },
}: SendVerificationRequestParams) {
  const { host, port, auth } = server;
  const transport = createTransport({
    host,
    port: Number(port),
    auth,
  });

  try {
    await transport.sendMail({
      to: email,
      from,
      subject: 'Sign in to your account',
      text: `Click here to sign in: ${url}`,
      html: `
        <div>
          <h1>Sign in to your account</h1>
          <p>Click the link below to sign in to your account:</p>
          <a href="${url}">Sign in</a>
          <p>If you didn't request this email, you can safely ignore it.</p>
        </div>
      `,
    });
  } catch (error) {
    logger.error(error, 'Failed to send verification email');
    throw new Error('Failed to send verification email');
  }
} 