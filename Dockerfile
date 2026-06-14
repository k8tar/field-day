# Multi-stage Dockerfile for Field Day Logger
# Stage 1: Build Rust backend
FROM rust:1.86 AS backend-builder

# Install OpenSSL development libraries
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend-service
COPY backend-service/Cargo.toml backend-service/Cargo.lock ./
COPY backend-service/src ./src

RUN cargo build --release

# Stage 2: Build Vue.js frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Install dependencies needed for node-gyp and native modules
RUN apk add --no-cache python3 make g++ pkgconfig openssl-dev

COPY package*.json ./

# Use a more targeted approach to avoid problematic packages
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm config set fetch-timeout 120000 && \
    npm config set registry https://registry.npmjs.org/ && \
    npm install --no-audit --no-fund

COPY . .

# Clean any existing build artifacts
RUN rm -rf dist/ dist-electron/ node_modules/.vite

# Build the application
RUN npm run build

# Stage 3: Runtime image
FROM node:20-alpine

WORKDIR /app

# Install required packages for running the application
RUN apk add --no-cache \
    ca-certificates \
    wget \
    && rm -rf /var/cache/apk/*

# Copy built backend
COPY --from=backend-builder /app/backend-service/target/release/fieldday-backend /usr/local/bin/fieldday-backend

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/package.json ./

# Install a simple HTTP server for serving the frontend
RUN npm install -g serve

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'fieldday-backend --port 3030 --discovery-port 3030 &' >> /app/start.sh && \
    echo 'serve -s dist -l 8080 &' >> /app/start.sh && \
    echo 'wait' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 8080 3030

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["/app/start.sh"]
