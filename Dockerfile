FROM node:26-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# GCIP / Firebase CLIENT config — PUBLIC browser config (ships in the client
# bundle by design; security is enforced by Firebase Auth + the API key's
# HTTP-referrer allowlist, NOT by key secrecy). Baked at build time so Vite
# inlines import.meta.env.VITE_GCIP_* and the SPA can initialize auth (login).
ENV VITE_GCIP_API_KEY=AIzaSyBCCtuVajEza6yHonlkz8XkVQJjIgAMS9o
ENV VITE_GCIP_AUTH_DOMAIN=united-planet-485003-n7-9f345.firebaseapp.com
ENV VITE_GCIP_PROJECT_ID=united-planet-485003-n7-9f345
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

RUN test -f dist/index.cjs && echo "Build verified: dist/index.cjs" || (echo "MISSING: dist/index.cjs" && exit 1)

FROM node:26-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN groupadd -r appuser && useradd -r -g appuser -s /bin/false appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]
