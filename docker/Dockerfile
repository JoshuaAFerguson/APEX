# APEX Docker Image
# Multi-stage build for production

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY packages/*/package*.json ./packages/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY turbo.json ./
COPY packages/*/package*.json ./packages/

RUN npm ci --production

# Copy built files
COPY --from=builder /app/packages/*/dist ./packages/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the API server
CMD ["node", "packages/api/dist/index.js"]
