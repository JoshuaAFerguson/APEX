#!/bin/bash
# Setup script for Playwright installation
set -e

echo "🚀 Setting up Playwright for APEX..."

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install

# Verify installation
echo "🔍 Verifying Playwright installation..."
npx playwright --version

echo "✅ Playwright setup completed successfully!"
echo ""
echo "Available commands:"
echo "  npm run playwright:test        - Run Playwright tests"
echo "  npm run playwright:test:headed - Run tests with browser UI"
echo "  npm run playwright:test:debug  - Debug tests"
echo "  npm run playwright:test:ui     - Run with Playwright UI"