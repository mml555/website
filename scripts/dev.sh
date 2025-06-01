#!/bin/bash

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Run the development server
npm run dev 