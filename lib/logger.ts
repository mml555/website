import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Helper function to safely stringify objects
const safeStringify = (obj: unknown): string => {
  try {
    if (obj instanceof Error) {
      return JSON.stringify({
        message: obj.message,
        stack: obj.stack,
        name: obj.name,
      });
    }
    if (typeof obj === 'object' && obj !== null) {
      return JSON.stringify(obj, null, 2);
    }
    return String(obj);
  } catch (error) {
    return '[Unable to stringify object]';
  }
};

// Wrap the logger methods to ensure proper error handling
const wrappedLogger = {
  error: (obj: unknown, msg?: string) => {
    const errorDetails = safeStringify(obj);
    logger.error({ error: errorDetails }, msg || 'Error occurred');
  },
  warn: (obj: unknown, msg?: string) => {
    const warningDetails = safeStringify(obj);
    logger.warn({ warning: warningDetails }, msg || 'Warning occurred');
  },
  info: (obj: unknown, msg?: string) => {
    const infoDetails = safeStringify(obj);
    logger.info({ info: infoDetails }, msg || 'Info message');
  },
  debug: (obj: unknown, msg?: string) => {
    const debugDetails = safeStringify(obj);
    logger.debug({ debug: debugDetails }, msg || 'Debug message');
  },
};

export { wrappedLogger as logger }; 