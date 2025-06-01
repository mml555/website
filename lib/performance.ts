export function measurePerformance(name: string, fn: () => Promise<any>) {
  const start = performance.now()
  return fn().finally(() => {
    const duration = performance.now() - start
  })
}

export function trackApiPerformance(handler: Function) {
  return async function (req: Request, ...args: any[]) {
    const start = performance.now()
    try {
      const result = await handler(req, ...args)
      const duration = performance.now() - start
      return result
    } catch (error) {
      const duration = performance.now() - start
      throw error
    }
  }
} 