FROM node:22-bookworm-slim AS scanners
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates curl git openssl && rm -rf /var/lib/apt/lists/*
COPY scripts/install-scanners.sh /tmp/install-scanners.sh
RUN bash /tmp/install-scanners.sh

FROM scanners AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY scanners ./scanners
RUN npm ci && npm run build:api && npm run build --workspace=packages/cli
RUN npm prune --omit=dev

FROM scanners AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api ./apps/api
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/scanners ./scanners
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/start.cjs"]
