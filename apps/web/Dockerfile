# syntax=docker/dockerfile:1
#
# The web image (kickoff-package.md §8.9): the Next.js standalone server.
# Build from the repository root, which is the build context:
#
#   docker build -f apps/web/Dockerfile -t wringy-web:<git-sha> .
#
# next.config.ts sets output: 'standalone' with outputFileTracingRoot at the
# repository root, so `next build` writes a minimal server to
# apps/web/.next/standalone/apps/web/server.js plus only the traced
# node_modules; .next/static and public are copied beside it by hand
# (node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md).
#
# Runtime environment (names only; @wringy/config/web): WRINGY_ENV and
# API_INTERNAL_URL. Without them /internal renders its "not configured" state.
# server.js reads PORT and HOSTNAME; Render sets PORT for a web service and
# requires the host 0.0.0.0 (https://render.com/docs/web-services).

# node:24-bookworm-slim pinned by digest: the multi-platform index Docker Hub
# served for both 24-bookworm-slim and 24.21.0-bookworm-slim on 2026-09-23
# (registry-1.docker.io manifests API), i.e. Node 24.21.0, the version .nvmrc
# pins. Re-resolve it on every Node patch bump.
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

FROM ${NODE_IMAGE} AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo
COPY . .
# pnpm at the exact version package.json's packageManager field names.
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
# web and the workspace packages it depends on, with dev dependencies (the build needs them).
RUN pnpm install --frozen-lockfile --filter "web..."
# next build fetches the Geist font from Google Fonts, so this step needs network access.
RUN pnpm --filter web build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3100
WORKDIR /app
# Owned by node so the server can write its .next/cache.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3100
CMD ["node", "apps/web/server.js"]
