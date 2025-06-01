import Image from 'next/image'
import { useState } from 'react'

interface ProductImageProps {
  src: string
  alt: string
  priority?: boolean
  sizes?: string
  className?: string
  width?: number
  height?: number
}

export default function ProductImage({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw",
  className = "object-cover rounded-lg",
  width,
  height,
}: ProductImageProps) {
  const [error, setError] = useState(false)
  const fallbackImage = "https://picsum.photos/seed/default/400/400"
  const imageSrc = error ? fallbackImage : (src || fallbackImage)

  // If width and height are provided, use them and do not use fill
  if (width && height) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        sizes={sizes}
        onError={() => setError(true)}
        unoptimized={src.startsWith('data:') || src.startsWith('blob:')}
      />
    )
  }

  // Otherwise, use fill with a parent that has aspect ratio
  return (
    <div className="relative w-full h-[200px] sm:h-[250px] md:h-[300px] lg:h-[350px] xl:h-[400px]">
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        onError={() => setError(true)}
        unoptimized={src.startsWith('data:') || src.startsWith('blob:')}
      />
    </div>
  )
} 