import { ErrorBoundary } from '@/components/ErrorBoundary'
import HomePageWrapper from './components/HomePageWrapper'

export default function Page() {
  return (
    <ErrorBoundary>
      <HomePageWrapper />
    </ErrorBoundary>
  )
} 