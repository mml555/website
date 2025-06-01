import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
  // Convert price, cost, salePrice from Decimal to number
  const productsWithNumberFields = products.map((p) => ({
    ...p,
    price: typeof p.price === 'object' && 'toNumber' in p.price ? p.price.toNumber() : Number(p.price),
    cost: p.cost ? (typeof p.cost === 'object' && 'toNumber' in p.cost ? p.cost.toNumber() : Number(p.cost)) : null,
    salePrice: p.salePrice ? (typeof p.salePrice === 'object' && 'toNumber' in p.salePrice ? p.salePrice.toNumber() : Number(p.salePrice)) : null,
  }));
  console.log('[ADMIN_PRODUCTS_API] page:', page, 'limit:', limit, 'search:', search, 'status:', status);
  console.log('[ADMIN_PRODUCTS_API] products.length:', productsWithNumberFields.length, 'total:', total);
  return NextResponse.json({ products: productsWithNumberFields, total });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { name, price, stock, isActive, categoryId, image, cost, salePrice } = body;
  if (!name || typeof price !== 'number' || typeof stock !== 'number' || !categoryId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  try {
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
    // Convert price, cost, salePrice from Decimal to number
    const productWithNumberFields = {
      ...product,
      price: typeof product.price === 'object' && 'toNumber' in product.price ? product.price.toNumber() : Number(product.price),
      cost: product.cost ? (typeof product.cost === 'object' && 'toNumber' in product.cost ? product.cost.toNumber() : Number(product.cost)) : null,
      salePrice: product.salePrice ? (typeof product.salePrice === 'object' && 'toNumber' in product.salePrice ? product.salePrice.toNumber() : Number(product.salePrice)) : null,
    };
    return NextResponse.json(productWithNumberFields, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
} 