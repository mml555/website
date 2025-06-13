import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find the user's cart
        const cart = await prisma.cart.findUnique({
            where: {
                userId: session.user.id
            }
        });

        if (cart) {
            // Delete all cart items for the cart
            await prisma.cartItem.deleteMany({
                where: {
                    cartId: cart.id
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error clearing cart:', error);
        return NextResponse.json(
            { error: 'Failed to clear cart' },
            { status: 500 }
        );
    }
} 