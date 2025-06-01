import Link from "next/link"

export default function HeroSection() {
  return (
    <section className="relative bg-gradient-to-r from-primary to-purple-600 text-white py-32 overflow-hidden" aria-label="Hero section">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8 animate-fade-in">
            Discover Your Style
          </h1>
          <p className="text-2xl mb-12 max-w-3xl mx-auto leading-relaxed text-white">
            Explore our curated collection of premium products, crafted with quality and delivered with care
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/products" 
              className="inline-block bg-white text-primary px-12 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white shadow-lg text-lg"
              aria-label="Browse our product collection"
            >
              Shop Now
            </Link>
            <Link 
              href="/categories" 
              className="inline-block bg-transparent border-2 border-white text-white px-12 py-4 rounded-lg font-semibold hover:bg-white/10 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white shadow-lg text-lg"
              aria-label="Browse product categories"
            >
              View Categories
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
} 