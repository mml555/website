import * as Sentry from '@sentry/nextjs'

const isDevelopment = process.env.NODE_ENV === 'development'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !isDevelopment,
  tracesSampleRate: isDevelopment ? 0 : 1.0,
  beforeSend(event) {
    // Filter out OpenTelemetry related errors and warnings
    if (
      event.exception?.values?.some(e => 
        e.value?.includes('OpenTelemetry') || 
        e.value?.includes('Critical dependency') ||
        e.value?.includes('require-in-the-middle')
      )
    ) {
      return null
    }
    return event
  },
  ignoreErrors: [
    // Ignore OpenTelemetry related errors
    /OpenTelemetry/,
    /Critical dependency/,
    /require-in-the-middle/,
    // Ignore webpack warnings
    /Critical dependency: the request of a dependency is an expression/,
    /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
  ],
}) 