# syntax=docker/dockerfile:1

# ==========================================
# Stage 1: Install Dependencies
# ==========================================
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# Stage 2: Build Application
# ==========================================
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variabel NEXT_PUBLIC_* harus tersedia saat build-time agar tertanam ke bundle client
ARG NEXT_PUBLIC_BASE_URL=https://transport.nismara.web.id
ARG NEXT_PUBLIC_APP_URL=https://transport.nismara.web.id
ARG NEXT_PUBLIC_R2_PUBLIC_URL=https://images.nismara.my.id
ARG NEXT_PUBLIC_DISCORD_GUILD_ID=863959415702028318
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_HALLOWEEN_THEME=false

ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL
ENV NEXT_PUBLIC_DISCORD_GUILD_ID=$NEXT_PUBLIC_DISCORD_GUILD_ID
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_HALLOWEEN_THEME=$NEXT_PUBLIC_HALLOWEEN_THEME
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ==========================================
# Stage 3: Production Runner (Standalone)
# ==========================================
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Siapkan direktori .next dengan ownership user non-root
RUN mkdir .next && chown nextjs:nodejs .next

# Output standalone sudah mencakup node_modules minimal & server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

