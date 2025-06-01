var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from '../lib/db';
function testWishlist() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Clean up any existing test data
            yield prisma.wishlistItem.deleteMany({
                where: {
                    user: { email: 'test@example.com' },
                },
            });
            yield prisma.product.deleteMany({
                where: {
                    name: 'Test Product',
                },
            });
            yield prisma.user.deleteMany({
                where: {
                    email: 'test@example.com',
                },
            });
            yield prisma.category.deleteMany({
                where: {
                    name: 'Test Category',
                },
            });
            // Create a test category
            const category = yield prisma.category.create({
                data: {
                    name: 'Test Category',
                    description: 'A test category for wishlist testing',
                },
            });
            // Create a test user
            const user = yield prisma.user.create({
                data: {
                    email: 'test@example.com',
                    name: 'Test User',
                },
            });
            // Create a test product
            const product = yield prisma.product.create({
                data: {
                    name: 'Test Product',
                    description: 'A test product for wishlist testing',
                    price: 99.99,
                    categoryId: category.id,
                },
            });
            // Add product to wishlist
            const wishlistItem = yield prisma.wishlistItem.create({
                data: {
                    userId: user.id,
                    productId: product.id,
                },
            });
            console.log('Created wishlist item:', wishlistItem);
            // Get user's wishlist
            const wishlist = yield prisma.wishlistItem.findMany({
                where: {
                    userId: user.id,
                },
                include: {
                    product: true,
                },
            });
            console.log('User wishlist:', wishlist);
            // Remove from wishlist
            yield prisma.wishlistItem.delete({
                where: {
                    id: wishlistItem.id,
                },
            });
            console.log('Removed from wishlist');
            // Clean up
            yield prisma.product.delete({
                where: {
                    id: product.id,
                },
            });
            yield prisma.user.delete({
                where: {
                    id: user.id,
                },
            });
            yield prisma.category.delete({
                where: {
                    id: category.id,
                },
            });
            console.log('Test completed successfully');
        }
        catch (error) {
            console.error('Test failed:', error);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
testWishlist();
