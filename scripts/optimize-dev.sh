#!/bin/bash

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Enable Next.js production mode for faster builds
export NODE_ENV=production

# Clear Next.js cache
rm -rf .next

# Install dependencies with specific flags
npm install --no-optional --no-audit --no-fund

# Run build with specific flags
npm run build

# Start development server with optimized settings
npm run dev 