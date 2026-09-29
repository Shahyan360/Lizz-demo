# syntax=docker/dockerfile:1
#
# Multi-stage build for the Next.js (App Router) standalone server.
#
#   deps    → install all deps + generate the Prisma client/engine for Linux
#   builder → compile the app into `.next/standalone` (self-contained server.js)
#   runner  → tiny, NON-ROOT runtime image carrying only the traced output
#
# No secret is ever baked in: build-time envs are dummy placeholders and the
# runtime reads real config (DATABASE_URL, GEMINI_API_KEY, …) from the
# environment provided by Railway / the CircleCI context.

############################  deps  ############################
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Prisma's query engine needs OpenSSL at generate- and run-time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
# Generate the Prisma client + NATIVE (linux) query engine so Next's file
# tracing bundles the correct engine into the standalone output below.
RUN npx prisma generate

############################  builder  ############################
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# OpenSSL must be present here too: `next build` runs Prisma during static
# generation, and without it Prisma mis-detects the OpenSSL version and loads the
# wrong query engine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy build-time config — NOT secrets. Passed INLINE to this one RUN so they
# are visible to `npm run build` but never persisted as image ENV. Real values
# are injected at runtime by Railway / the CircleCI context.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" \
    NEXTAUTH_SECRET="build-time-placeholder" \
    ENCRYPTION_KEY="build-time-placeholder" \
    sh -c 'npx prisma generate && npm run build'

############################  runner  ############################
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker auto-sets HOSTNAME to the container id; pin it so Next's standalone
    # server binds all interfaces instead of the (unroutable) container hostname.
    HOSTNAME=0.0.0.0
# Run as an unprivileged, non-root user.
RUN groupadd --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --home-dir /app --shell /usr/sbin/nologin nextjs
# Copy ONLY the traced standalone server + static assets (no source, no dev deps).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
