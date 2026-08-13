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
RUN apk add --no-cache bash
COPY --from=builder /app/package*.json ./
# Install all dependencies including devDependencies for tsx
RUN npm install
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000 3003
CMD ["/bin/bash", "scripts/start-production.sh"]
