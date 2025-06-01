import * as Sentry from '@sentry/nextjs'

export function measurePerformance(name: string, fn: () => Promise<any>) {
  const start = performance.now()
  return fn().finally(() => {
    const duration = performance.now() - start
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name} took ${duration.toFixed(2)}ms`,
      level: 'info',
    })
  })
}

export function trackApiPerformance(handler: Function) {
  return async function (req: Request, ...args: any[]) {
    const start = performance.now()
    try {
      const result = await handler(req, ...args)
      const duration = performance.now() - start
      Sentry.addBreadcrumb({
        category: 'api',
        message: `${req.method} ${req.url} took ${duration.toFixed(2)}ms`,
        level: 'info',
      })
      return result
    } catch (error) {
      const duration = performance.now() - start
      Sentry.addBreadcrumb({
        category: 'api',
        message: `${req.method} ${req.url} failed after ${duration.toFixed(2)}ms`,
        level: 'error',
      })
      throw error
    }
  }
} 