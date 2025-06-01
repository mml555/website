#!/bin/bash

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Disable telemetry and Sentry in development
export NEXT_TELEMETRY_DISABLED=1

# Clear caches
rm -rf .next
rm -rf node_modules/.cache

# Install dependencies with specific flags
npm install --no-optional --no-audit --no-fund

# Start the development server in turbo mode using the local next command
./node_modules/.bin/next dev --turbo 