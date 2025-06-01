import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    if (!token || !password || password.length < 8) {
      return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
    }
    // Find the verification token
    const verification = await prisma.verificationToken.findUnique({ where: { token } });
    if (!verification || verification.expires < new Date()) {
      return NextResponse.json({ message: 'Token is invalid or expired.' }, { status: 400 });
    }
    // Find the user by email
    const user = await prisma.user.findUnique({ where: { email: verification.identifier } });
    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }
    // Hash the password
    const hashed = crypto.createHash('sha256').update(password).digest('hex');
    // Update the user's password
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    // Delete the verification token
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ message: 'Password set successfully.' });
  } catch (e) {
    return NextResponse.json({ message: 'Server error.' }, { status: 500 });
  }
} 