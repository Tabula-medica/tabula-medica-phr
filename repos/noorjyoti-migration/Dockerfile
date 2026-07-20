# syntax=docker/dockerfile:1.7
# ============================================================================
# NoorJyoti — production container for Cloud Run.
#
# ONE image, ONE $PORT, serving BOTH:
#   • the Astro SSR marketing site (ekdharma-site, @astrojs/node middleware mode)
#   • the Express api-server (/api/* routes, Postgres via pg/drizzle)
# composed by deploy/server.mjs.
#
# Why build inside linux/amd64: the repo's pnpm `overrides` pin every non-
# linux-x64 native binary (esbuild, rollup, lightningcss, @tailwindcss/oxide) to
# "-", so `pnpm install` only resolves linux-x64 prebuilts. Building in a
# linux/amd64 Node image is exactly the platform those pins target — the install
# and Astro/esbuild builds succeed unchanged, no WSL needed on the dev machine.
#
# Single stage on purpose: the Astro SSR handler needs the `astro` runtime (a
# devDependency of ekdharma-site) plus React SSR deps at runtime, and the api
# bundle externalizes @google-cloud/storage — so we keep the installed
# node_modules rather than trying to prune to a prod-only subset.
# ============================================================================
FROM --platform=linux/amd64 node:24-bookworm-slim AS app

# Corepack ships pnpm with Node 24; pin the major used in CI.
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy the whole workspace (manifests + source). .dockerignore strips
# node_modules/dist/secrets so the context stays small.
COPY . .

# Install only the two deployable packages and their workspace dependencies
# (the "..." suffix pulls in @workspace/db, @workspace/api-zod, etc.). This skips
# the mobile/expo and other unrelated workspaces entirely — smaller, faster, and
# avoids react-native native resolution. Dev deps are included (needed to build
# AND to run the Astro SSR handler, whose `astro` runtime is a devDependency). No
# committed lockfile exists, so we don't use --frozen-lockfile; minimumReleaseAge
# in pnpm-workspace.yaml still applies.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --filter "@workspace/ekdharma-site..." --filter "@workspace/api-server..." --filter "@workspace/web..."

# Build-time env. astro.config.mjs requires PORT at config-load time; the real
# listen port comes from Cloud Run's $PORT at runtime. BASE_PATH=/ serves the
# site at the root so relative /api calls from the client work as-is.
ENV NODE_ENV=production \
    PORT=8080 \
    BASE_PATH=/

# 1) Bundle api-server/src/app.ts -> dist/app.mjs (no app.listen side-effect).
#    Run via pnpm --filter exec so esbuild resolves from the api-server package's
#    node_modules under pnpm's isolated (non-hoisted) layout.
RUN pnpm --filter @workspace/api-server exec node build-app.mjs

# 2) Build the Astro SSR site -> dist/server/entry.mjs (handler) + dist/client.
RUN pnpm --filter @workspace/ekdharma-site run build

# 3) Build the React reader SPA -> artifacts/web/dist/public. Served at /app
#    (base=/app/ so its hashed assets resolve under /app). The Astro marketing
#    site stays at "/"; the reader lives at /app/*.
RUN BASE_PATH=/app/ pnpm --filter @workspace/web run build

# Drop privileges: the stock node image ships a non-root "node" user. The build
# outputs and node_modules are owned by root; make them readable/executable and
# hand the app dir to node.
RUN chown -R node:node /app
USER node

EXPOSE 8080
# server.prod.mjs is the esbuild-bundled wrapper (express inlined); see build-app.mjs.
CMD ["node", "--enable-source-maps", "deploy/server.prod.mjs"]
