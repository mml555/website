import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import Image from 'next/image'

// Create images directory if it doesn't exist
const PUBLIC_DIR = path.join(process.cwd(), 'public')
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images')

// Ensure the images directory exists
async function ensureImagesDirectory() {
  try {
    await fs.access(IMAGES_DIR)
  } catch {
    await fs.mkdir(IMAGES_DIR, { recursive: true })
  }
}

export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
}

export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const {
    width = 800,
    height,
    quality = 80,
    format = 'webp',
  } = options

  let pipeline = sharp(buffer)

  // Resize if dimensions are provided
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // Convert to specified format
  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality })
      break
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality })
      break
    case 'png':
      pipeline = pipeline.png({ quality })
      break
  }

  return pipeline.toBuffer()
}

export async function saveImageLocally(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await ensureImagesDirectory()
  const filePath = path.join(IMAGES_DIR, key)
  await fs.writeFile(filePath, buffer)
  return `/images/${key}` // Return the public URL path
}

export async function processAndUploadImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const optimizedBuffer = await optimizeImage(buffer, options)
  const format = options.format || 'webp'
  const key = `${uuidv4()}.${format}`
  
  return saveImageLocally(
    optimizedBuffer,
    key,
    `image/${format}`
  )
}

// Image component with lazy loading and blur placeholder
export function ImageWithPlaceholder({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ paddingBottom: `${(height / width) * 100}%` }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  )
} 