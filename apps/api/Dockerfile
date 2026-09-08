FROM node:20-alpine
WORKDIR /app

# Copy root configurations
COPY package*.json tsconfig.json ./

# Copy api workspace and dependencies
COPY apps ./apps
COPY packages ./packages
COPY scanners ./scanners

# Install dependencies for workspaces
RUN npm install
RUN npm run build --workspace=packages/types
RUN cd apps/api && npx prisma generate
RUN npm run build --workspace=apps/api

EXPOSE 3001

CMD ["sh", "-c", "cd apps/api && npx prisma db push --accept-data-loss && node dist/index.js"]
