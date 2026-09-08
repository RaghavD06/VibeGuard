FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config and lockfile
COPY package.json package-lock.json* tsconfig.json ./

# Copy all workspaces
COPY apps ./apps
COPY packages ./packages
COPY scanners ./scanners

# Install dependencies, generate Prisma client, and build workspaces
RUN npm install
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/security-engine
RUN npm run build --workspace=packages/ai-engine
RUN cd apps/api && npx prisma generate
RUN npm run build --workspace=apps/api

# Pre-generate sqlite schema
ENV DATABASE_URL="file:/app/apps/api/prisma/dev.db"
RUN cd apps/api && npx prisma db push --accept-data-loss

# --- Production Image ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/app/apps/api/prisma/dev.db"

# Copy root config, dependencies and workspaces
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/scanners ./scanners
COPY --from=builder /app/apps/api ./apps/api

RUN mkdir -p /app/apps/api/prisma

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the API with database push ensuring tables exist
CMD ["sh", "-c", "cd apps/api && (npx prisma db push --accept-data-loss || true) && node dist/index.js"]

