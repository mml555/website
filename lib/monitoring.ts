import { logger } from './logger'

interface MetricData {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp?: number
}

interface ErrorData {
  error: Error
  context?: Record<string, any>
  timestamp?: number
}

class Monitoring {
  private metrics: MetricData[] = []
  private errors: ErrorData[] = []
  private readonly maxMetrics = 1000
  private readonly maxErrors = 100

  // Performance monitoring
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - startTime
      this.recordMetric(name, duration, tags)
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      this.recordMetric(`${name}_error`, duration, tags)
      throw error
    }
  }

  measureSync<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T {
    const startTime = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - startTime
      this.recordMetric(name, duration, tags)
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      this.recordMetric(`${name}_error`, duration, tags)
      throw error
    }
  }

  // Metric recording
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    const metric: MetricData = {
      name,
      value,
      tags,
      timestamp: Date.now()
    }

    this.metrics.push(metric)
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    logger.debug(`Metric recorded: ${name}`, { value, tags })
  }

  // Error tracking
  trackError(error: Error, context?: Record<string, any>) {
    const errorData: ErrorData = {
      error,
      context,
      timestamp: Date.now()
    }

    this.errors.push(errorData)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    logger.error(`Error tracked: ${error.message}`, { error, context })
  }

  // Analytics
  getMetrics(name?: string, tags?: Record<string, string>) {
    let filtered = this.metrics
    if (name) {
      filtered = filtered.filter(m => m.name === name)
    }
    if (tags) {
      filtered = filtered.filter(m => 
        Object.entries(tags).every(([k, v]) => m.tags?.[k] === v)
      )
    }
    return filtered
  }

  getErrors() {
    return this.errors
  }

  // Performance analysis
  getAverageMetric(name: string, tags?: Record<string, string>): number {
    const metrics = this.getMetrics(name, tags)
    if (metrics.length === 0) return 0
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }

  getPercentileMetric(
    name: string,
    percentile: number,
    tags?: Record<string, string>
  ): number {
    const metrics = this.getMetrics(name, tags)
    if (metrics.length === 0) return 0

    const sorted = [...metrics].sort((a, b) => a.value - b.value)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index].value
  }

  // Clear data
  clearMetrics() {
    this.metrics = []
  }

  clearErrors() {
    this.errors = []
  }
}

export const monitoring = new Monitoring() 