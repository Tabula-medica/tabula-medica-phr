FROM node:26-slim AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run server:build


FROM node:26-slim AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV SKIP_METRO=true

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /usr/src/app/server_dist ./server_dist
COPY --from=builder /usr/src/app/server/templates ./server/templates
COPY --from=builder /usr/src/app/server/well-known ./server/well-known
COPY --from=builder /usr/src/app/shared ./shared

USER node

CMD ["node", "server_dist/index.js"]
