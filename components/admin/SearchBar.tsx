import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  debounceMs?: number
}

export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const initialQuery = searchParams.get('q') || ''
    setQuery(initialQuery)
  }, [searchParams])

  const handleSearch = (value: string) => {
    setQuery(value)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      router.push(`?${params.toString()}`)
      onSearch?.(value)
    }, debounceMs)
  }

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        placeholder={placeholder}
      />
    </div>
  )
} 