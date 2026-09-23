# syntax=docker/dockerfile:1
#
# The worker image (kickoff-package.md §8.9): the esbuild bundle dist/main.js
# on the production node_modules `pnpm deploy` assembles. Build from the
# repository root, which is the build context:
#
#   docker build -f apps/worker/Dockerfile -t wringy-worker:<git-sha> .
#
# Environment (names only; @wringy/config/worker): WRINGY_ENV, DATABASE_URL
# (the wringy_worker_login runtime login), WORKER_ID, IMAGE_REF, LOG_LEVEL.
#
# Stop: node runs as PID 1 (exec-form CMD), so SIGTERM reaches the worker's
# own handler, which drains for up to 20 s and exits within 30 s
# (apps/worker/README.md "Stop and drain"). Docker's default stop timeout is
# 10 s, so stop it with `docker stop --time 35`.

# node:24-bookworm-slim pinned by digest (Node 24.21.0); see apps/web/Dockerfile.
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY . .
# pnpm at the exact version package.json's packageManager field names.
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN pnpm install --frozen-lockfile --filter "worker..."
RUN pnpm --filter worker build
# Production dependencies only; pnpm 10 deploys workspace dependencies only
# with inject-workspace-packages or --legacy (https://pnpm.io/cli/deploy).
RUN pnpm --filter worker --prod deploy --legacy /out/worker

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
# package.json carries "type": "module" for the ESM bundle.
COPY --from=build /out/worker/package.json ./package.json
COPY --from=build /out/worker/node_modules ./node_modules
COPY --from=build /repo/apps/worker/dist ./dist
USER node
CMD ["node", "dist/main.js"]
