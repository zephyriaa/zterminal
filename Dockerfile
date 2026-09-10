FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm ci || npm install
COPY . .
# Auth.js imports the Prisma adapter while Next.js collects route configuration.
# Generate the client from the checked-in schema before the production build.
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_UNSAFE_PERM=true
RUN apk add --no-cache bash caddy
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/mini-services ./mini-services
# The TypeScript gateway imports the shared Gate.io normalization module at runtime.
COPY --from=builder /app/src/lib/market ./src/lib/market
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/Caddyfile ./Caddyfile

EXPOSE 8080
CMD ["/bin/bash", "scripts/start-production.sh"]
