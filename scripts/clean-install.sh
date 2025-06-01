#!/bin/bash

# Remove all caches and build artifacts
rm -rf .next
rm -rf node_modules
rm -rf node_modules/.cache
rm -rf .turbo

# Clear npm cache
npm cache clean --force

# Install dependencies with specific flags
npm install --no-optional --no-audit --no-fund

# Make the dev script executable
chmod +x scripts/dev-optimized.sh

echo "Clean install complete. Run ./scripts/dev-optimized.sh to start the development server." 