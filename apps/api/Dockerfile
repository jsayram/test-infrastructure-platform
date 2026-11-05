FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3
WORKDIR /app
ENV BIND_HOST=0.0.0.0
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules/
COPY --chown=node:node package.json ./
COPY --chown=node:node apps/api/app.js apps/api/server.js apps/api/data-route.js apps/api/store.js ./apps/api/
COPY --chown=node:node apps/web/index.html apps/web/app.js ./apps/web/
USER node
EXPOSE 3000
CMD ["node", "apps/api/server.js"]
