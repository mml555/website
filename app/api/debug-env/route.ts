import { NextResponse } from 'next/server';
import { clientEnv } from '@/lib/env';

export async function GET() {
  // Only expose safe client env vars
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    serverEnv: 'hidden',
    clientEnv,
    note: 'Server env is never exposed. Only NEXT_PUBLIC_* vars are shown.'
  });
} 