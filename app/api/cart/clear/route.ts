import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export async function POST(req: Request) {
    try {
        const { guestId } = await req.json();
        
        if (!guestId) {
            return NextResponse.json(
                { error: 'Guest ID is required' },
                { status: 400 }
            );
        }

        if (!redis) {
            return NextResponse.json(
                { error: 'Redis is not available' },
                { status: 500 }
            );
        }

        // Clear the guest cart from Redis
        await redis.del(`guest_cart:${guestId}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error clearing guest cart:', error);
        return NextResponse.json(
            { error: 'Failed to clear guest cart' },
            { status: 500 }
        );
    }
} 