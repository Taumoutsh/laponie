# syntax=docker/dockerfile:1

# ---------- Dépendances ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- Build ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
 && npx next build \
 && npm prune --omit=dev

# ---------- Exécution ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=6104 \
    HOSTNAME=0.0.0.0

RUN addgroup -S laponie && adduser -S laponie -G laponie
COPY --from=builder --chown=laponie:laponie /app/package.json ./package.json
COPY --from=builder --chown=laponie:laponie /app/node_modules ./node_modules
COPY --from=builder --chown=laponie:laponie /app/.next ./.next
COPY --from=builder --chown=laponie:laponie /app/public ./public
COPY --from=builder --chown=laponie:laponie /app/prisma ./prisma
COPY --chown=laponie:laponie docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER laponie
EXPOSE 6104
ENTRYPOINT ["./docker-entrypoint.sh"]
