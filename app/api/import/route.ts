import { NextResponse } from 'next/server'
import { importProductsFromExcel } from '@/lib/excel'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertDecimalsToNumbers } from '@/lib/AppUtils'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    // File type/size validation
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only Excel files are allowed.' },
        { status: 400 }
      )
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json(
        { error: 'File too large. Max 5MB allowed.' },
        { status: 400 }
      )
    }
    const products = await importProductsFromExcel(file)
    const productsWithNumberFields = convertDecimalsToNumbers(products)
    await prisma.auditLog.create({
      data: {
        action: 'IMPORT_PRODUCTS',
        userId: session.user.id,
        details: JSON.stringify({ count: products.length, fileName: file.name }),
      },
    })
    return NextResponse.json({ message: 'Products imported successfully', products: productsWithNumberFields })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Error importing products' },
      { status: 500 }
    )
  }
} 