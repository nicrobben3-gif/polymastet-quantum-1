# =========================================================================
# POLYMASTER QUANTUM - PRODUCTION DOCKERFILE
# Multi-stage production build for 24/7 low-latency autonomous execution
# =========================================================================

# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native compilation if required
RUN apk add --no-cache python3 make g++ git

# Copy package descriptors first to take advantage of Docker layer caching
COPY package.json package-lock.json* .npmrc* ./

# Install all dependencies including devDependencies for build
RUN npm install --legacy-peer-deps

# Copy source code and configurations
COPY . .

# Build production assets (Vite React output into /app/dist)
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for container healthchecks
RUN apk add --no-cache curl

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create application user for security (non-root execution)
USER node

# Copy build artifacts and runtime configuration from builder stage
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/server.ts ./server.ts
COPY --chown=node:node --from=builder /app/tsconfig.json ./tsconfig.json
COPY --chown=node:node --from=builder /app/vite.config.ts ./vite.config.ts

# Persistent volume directories for logs and local state
VOLUME ["/app/data", "/app/logs"]

# Expose institutional port
EXPOSE 3000

# Docker healthcheck verifying real healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

# Launch full-stack production server with API & static frontend
CMD ["npm", "start"]
