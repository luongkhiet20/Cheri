# ==============================================================================
# Multi-Stage Dockerfile for Chéri Fashion (Angular 20 SSR + NestJS Backend)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build stage
# ------------------------------------------------------------------------------
FROM node:24-alpine3.21 AS builder

# Install native build tools for compiling C++ native modules (bcrypt, saslprep, etc.)
RUN apk add --no-cache python3 make g++ git

WORKDIR /usr/src/app

# Copy dependency specifications first for Docker cache optimization
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci --no-audit

# Copy source code (files ignored via .dockerignore)
COPY . ./

# Build Angular SSR application (produces dist/cheri/browser and dist/cheri/server)
RUN npm run build:ssr

# Build NestJS backend (produces server/dist)
RUN npm run build:server

# Prune devDependencies to reduce image size
RUN npm prune --omit=dev --no-audit

# ------------------------------------------------------------------------------
# Stage 2: Production runtime image
# ------------------------------------------------------------------------------
FROM node:24-alpine3.21 AS runner

# Install dumb-init for proper PID 1 signal forwarding (SIGTERM, SIGINT) and curl for healthcheck
RUN apk add --no-cache dumb-init curl

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=4000
ENV ADMIN_PORT=5000

# Copy package manifests and production dependencies from builder
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy built application bundles
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/server ./server

# Create uploads directory for persistent storage and assign ownership to node user
RUN mkdir -p /usr/src/app/server/uploads/payment-proofs \
    && chown -R node:node /usr/src/app

# Run as non-root user for security
USER node

# Expose primary SSR / Customer API port (4000) and Admin API port (5000)
EXPOSE 4000 5000

# Container healthcheck: verify application responds on primary port
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://127.0.0.1:4000/api/cheri/home || exit 1

# Handle init process signals cleanly
ENTRYPOINT ["dumb-init", "--"]

# Launch production SSR + Backend server (auto-forks admin server on port 5000)
CMD ["node", "dist/cheri/server/server.mjs"]
