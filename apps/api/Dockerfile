FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/app/apps/api/prisma/dev.db"

# Copy root configurations
COPY package*.json tsconfig.json ./

# Copy api workspace and dependencies
COPY apps ./apps
COPY packages ./packages
COPY scanners ./scanners

# Install dependencies for workspaces and build required packages
RUN npm install
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/security-engine
RUN npm run build --workspace=packages/ai-engine
RUN cd apps/api && npx prisma generate
RUN npm run build --workspace=apps/api
RUN cd apps/api && npx prisma db push --accept-data-loss

EXPOSE 3001

CMD ["sh", "-c", "cd apps/api && (npx prisma db push --accept-data-loss || true) && node dist/index.js"]
