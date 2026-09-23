# syntax=docker/dockerfile:1
#
# The api image (kickoff-package.md §8.9): the esbuild bundle dist/main.js on
# the production node_modules `pnpm deploy` assembles, plus the database
# migrations and a bundled migration CLI for a one-off migrate step.
# Build from the repository root, which is the build context:
#
#   docker build -f apps/api/Dockerfile -t wringy-api:<git-sha> .
#
# Serve (names only; @wringy/config/api): WRINGY_ENV, DATABASE_URL (the
# wringy_api_login runtime login), LOG_LEVEL. HOST and PORT default to
# 0.0.0.0:3200 here; Render sets PORT for a web service and requires the host
# 0.0.0.0 (https://render.com/docs/web-services).
#
# Migrate once per release, before the new api and worker start, with the same
# image and the migrator login (never a runtime login):
#
#   docker run --rm -e WRINGY_ENV=<env> -e DATABASE_URL_MIGRATOR=<migrator URL> \
#     wringy-api:<git-sha> node /migrate/dist/migrate.js
#
# That is `pnpm db:migrate` (packages/db/src/cli/migrate.ts) bundled by
# `pnpm --filter @wringy/db build`: the pg-boss schema, then the pending SQL
# migrations from /migrate/migrations, then a head check; rerunning changes
# nothing. The roles (`pnpm db:bootstrap`) and the environment marker
# (`pnpm db:env`) are one-time steps per environment, run from a checkout
# (packages/db/README.md), not from this image.

# node:24-bookworm-slim pinned by digest (Node 24.21.0); see apps/web/Dockerfile.
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

FROM ${NODE_IMAGE} AS build
WORKDIR /repo
COPY . .
# pnpm at the exact version package.json's packageManager field names.
RUN npm install --global "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")"
RUN pnpm install --frozen-lockfile --filter "api..."
RUN pnpm --filter api build && pnpm --filter @wringy/db build
# Production dependencies only. pnpm 10 deploys workspace dependencies only
# with inject-workspace-packages or --legacy (https://pnpm.io/cli/deploy);
# --legacy leaves the workspace's own linking unchanged for development.
RUN pnpm --filter api --prod deploy --legacy /out/api \
 && pnpm --filter @wringy/db --prod deploy --legacy /out/migrate

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3200
WORKDIR /app
# Each package.json carries "type": "module" for its ESM bundle.
COPY --from=build /out/api/package.json ./package.json
COPY --from=build /out/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /out/migrate/package.json /migrate/package.json
COPY --from=build /out/migrate/node_modules /migrate/node_modules
COPY --from=build /repo/packages/db/migrations /migrate/migrations
COPY --from=build /repo/packages/db/dist /migrate/dist
USER node
EXPOSE 3200
CMD ["node", "dist/main.js"]
