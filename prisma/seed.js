var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const prisma = new PrismaClient();
// Helper function to hash password
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Create test user
        const hashedPassword = hashPassword('test123');
        yield prisma.user.upsert({
            where: { email: 'test@example.com' },
            update: {},
            create: {
                email: 'test@example.com',
                name: 'Test User',
                password: hashedPassword,
                role: 'ADMIN',
            },
        });
        // Ensure at least one category exists
        const category = yield prisma.category.upsert({
            where: { name: 'Sample Category' },
            update: {},
            create: {
                name: 'Sample Category',
                description: 'A category for sample products',
            },
        });
        // Add 50 sample products
        for (let i = 1; i <= 50; i++) {
            yield prisma.product.create({
                data: {
                    name: `Sample Product ${i}`,
                    description: `This is the description for Sample Product ${i}.`,
                    price: Math.floor(Math.random() * 10000) / 100,
                    categoryId: category.id,
                    image: `https://picsum.photos/seed/${i}/400/400`,
                },
            });
        }
        // Create guest user
        const guestUser = yield prisma.user.upsert({
            where: { email: 'guest@example.com' },
            update: {},
            create: {
                email: 'guest@example.com',
                name: 'Guest User',
                role: 'USER',
            },
        });
        console.log('Seed complete: test user and 50 products added.');
        console.log('Guest user created:', guestUser);
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
