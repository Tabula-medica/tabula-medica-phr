FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# GCIP (Firebase) web config — MUST be present at build time so Vite bakes it into the client bundle.
# Without these the client initializes Firebase with empty config -> auth/internal-error on every login.
ARG VITE_GCIP_API_KEY
ARG VITE_GCIP_AUTH_DOMAIN
ARG VITE_GCIP_PROJECT_ID
ENV VITE_GCIP_API_KEY=$VITE_GCIP_API_KEY \
    VITE_GCIP_AUTH_DOMAIN=$VITE_GCIP_AUTH_DOMAIN \
    VITE_GCIP_PROJECT_ID=$VITE_GCIP_PROJECT_ID

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

RUN test -f dist/index.cjs && echo "Build verified: dist/index.cjs" || (echo "MISSING: dist/index.cjs" && exit 1)

FROM node:20-slim
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
