'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export function HeroSectionClient() {
  const router = useRouter()

  return (
    <section className="relative bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Discover Amazing Products
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Shop the latest trends with our curated collection of premium products
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/products')}
            className="bg-white text-purple-600 px-8 py-3 rounded-full font-semibold text-lg hover:bg-opacity-90 transition-colors"
          >
            Shop Now
          </motion.button>
        </motion.div>
      </div>
    </section>
  )
} 