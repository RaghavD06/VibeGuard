FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy root configurations
COPY package.json package-lock.json tsconfig.json ./

# Copy web workspace
COPY apps/web ./apps/web
COPY packages ./packages
COPY scanners ./scanners
COPY apps/api ./apps/api

# Install dependencies for workspace
RUN npm ci

# Build
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=apps/web

FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
