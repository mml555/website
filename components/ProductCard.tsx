import React, { useState } from 'react';
import { Product } from '@/types/product';
import { formatPrice } from '@/lib/AppUtils';
import Link from 'next/link';
import Image from 'next/image';
import AddToCartButton from './product/AddToCartButton';
import { useSession } from 'next-auth/react';

interface ProductCardProps {
  product: Product;
  index: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, index }) => {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [imageError, setImageError] = useState(false);

  // Get the first valid image URL from either images array or single image
  const getImageUrl = () => {
    if (imageError) return '/images/placeholder.svg';
    if (Array.isArray(product.images) && product.images.length > 0) {
      const url = product.images[0];
      if (url && url.startsWith('/')) return url; // local image
      if (url && url.startsWith('http')) return url; // remote image
    }
    return getDefaultImage();
  };

  const imageUrl = getImageUrl();
  const isOutOfStock = !product.stock || product.stock <= 0;

  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="aspect-h-1 aspect-w-1 w-full overflow-hidden rounded-t-lg bg-gray-100">
        <Link href={`/products/${product.id}`}>
          <Image
            src={imageUrl}
            alt={product.name}
            width={500}
            height={500}
            className="h-full w-full object-cover object-center group-hover:opacity-90 transition-opacity duration-300"
            priority={index < 4}
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            quality={75}
          />
        </Link>
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <span className="bg-white px-3 py-1 rounded-full text-sm font-medium text-gray-900">
              Out of Stock
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 group-hover:text-[#1e40af] transition-colors duration-200">
              <Link href={`/products/${product.id}`}>
                <span aria-hidden="true" className="absolute inset-0" />
                {product.name}
              </Link>
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {product.category ? (typeof product.category === 'object' ? product.category.name : product.category) : 'Uncategorized'}
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900">{formatPrice(Number(product.price) || 0)}</p>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-4">
          {product.description}
        </p>
        <div className="space-y-2">
          <AddToCartButton
            productId={product.id}
            name={product.name}
            price={product.price}
            image={imageUrl}
            stock={product.stock}
            userId={session?.user?.id}
            simple={true}
          />
        </div>
        {isAdmin && (
          <div className="mt-2">
            <Link
              href={`/dashboard/products/${product.id}`}
              className="block w-full text-center text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded py-2 transition-colors duration-200"
              style={{ position: 'relative', zIndex: 10 }}
            >
              Edit Product
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

function getDefaultImage() {
  return '/images/placeholder.svg';
}

export default ProductCard; 