import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminProductCreateSchema } from '@/lib/validations/schemas';
import { convertDecimalsToNumbers } from '@/lib/AppUtils';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);
    const productsWithNumberFields = convertDecimalsToNumbers(products);
    const pages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      products: productsWithNumberFields,
      pagination: { total: total, page, limit, pages }
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = adminProductCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, price, stock, isActive, categoryId, image, cost, salePrice } = parsed.data;
    const product = await prisma.product.create({
      data: {
        name,
        price,
        stock,
        isActive: isActive ?? true,
        categoryId,
        images: image ? [image] : [],
        cost,
        salePrice,
      },
    });
    const productWithNumberFields = convertDecimalsToNumbers(product);
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_PRODUCT',
        userId: session.user.id,
        details: JSON.stringify({ productId: product.id, created: productWithNumberFields }),
      },
    });
    return NextResponse.json(productWithNumberFields, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
} 