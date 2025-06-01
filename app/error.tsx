'use client'

import { useEffect } from 'react'
let Sentry: any = null;
try {
  Sentry = require('@sentry/nextjs');
} catch (e) {
  Sentry = null;
}

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to the console or a logging service
    // eslint-disable-next-line no-console
    console.error('Global RSC Error:', error);
    if (error && error.stack) {
      // eslint-disable-next-line no-console
      console.error('Error stack:', error.stack);
    }
  }, [error]);

  return (
    <div style={{ color: 'red', padding: 32 }}>
      <h1>Something went wrong!</h1>
      <pre>{error.message}</pre>
      <button onClick={reset}>Try again</button>
    </div>
  );
} 