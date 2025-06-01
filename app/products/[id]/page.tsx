import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ProductDetails from '@/components/product/ProductDetails'
import { getProduct } from '@/lib/api/products'
import RelatedProducts from '@/components/product/RelatedProducts'

interface ProductPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const product = await getProduct(resolvedParams.id)
  
  if (!product) {
    return {
      title: 'Product Not Found',
      description: 'The requested product could not be found.'
    }
  }

  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0] ? [product.images[0]] : [],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)
  
  try {
    const product = await getProduct(resolvedParams.id)

    if (!product) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900">Product Not Found</h2>
            <p className="mt-2 text-gray-600">
              The product you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <a
              href="/products"
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Browse Products
            </a>
          </div>
        </div>
      )
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <ProductDetails product={product} session={session} />
        <div className="mt-16">
          <RelatedProducts productId={resolvedParams.id} type="similar" />
        </div>
        <div className="mt-16">
          <RelatedProducts productId={resolvedParams.id} type="complementary" />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading product:', error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Error Loading Product</h2>
          <p className="mt-2 text-gray-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <a
            href="/products"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Browse Products
          </a>
        </div>
      </div>
    )
  }
} 