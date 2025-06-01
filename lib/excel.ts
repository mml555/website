import * as XLSX from 'xlsx'
import { prisma } from './db'

export async function importProductsFromExcel(file: File) {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    const products = await Promise.all(
      data.map(async (row: any) => {
        // Create or find category
        const category = await prisma.category.upsert({
          where: { name: row.category || 'Uncategorized' },
          update: {},
          create: { name: row.category || 'Uncategorized' },
        })

        // Create product
        return prisma.product.create({
          data: {
            name: row.name,
            description: row.description || '',
            price: parseFloat(row.price),
            sku: row.sku,
            stock: parseInt(row.stock),
            images: row.images ? row.images.split(',') : [],
            categoryId: category.id,
          },
        })
      })
    )

    return products
  } catch (error) {
    console.error('Error importing products:', error)
    throw new Error('Failed to import products from Excel file')
  }
} 