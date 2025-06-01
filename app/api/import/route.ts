import { NextResponse } from 'next/server'
import { importProductsFromExcel } from '@/lib/excel'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const products = await importProductsFromExcel(file)
    return NextResponse.json({ message: 'Products imported successfully', products })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Error importing products' },
      { status: 500 }
    )
  }
} 