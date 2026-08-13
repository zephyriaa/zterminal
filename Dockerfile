FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_UNSAFE_PERM=true
RUN apk add --no-cache bash caddy
COPY --from=builder /app/package*.json ./
# The market-data gateway is executed with tsx at runtime.
RUN npm ci --include=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/mini-services ./mini-services
# The TypeScript gateway imports the shared Gate.io normalization module at runtime.
COPY --from=builder /app/src/lib/market ./src/lib/market
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/Caddyfile ./Caddyfile

EXPOSE 8080
CMD ["/bin/bash", "scripts/start-production.sh"]
