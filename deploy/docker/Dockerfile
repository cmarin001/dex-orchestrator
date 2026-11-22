ARG BUILD_VERSION=dev
FROM node:20-bookworm-slim AS deps
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.json tsconfig.build.json health.ts ./
COPY src/ ./src/
COPY schemas/ ./schemas/
RUN ./node_modules/.bin/tsc -p tsconfig.build.json && npm prune --omit=dev --no-audit --no-fund

FROM node:20-bookworm-slim AS runtime
ARG BUILD_VERSION
ENV BUILD_VERSION=${BUILD_VERSION}
LABEL org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.source="https://github.com/cmarin001/dex-orchestrator" \
      org.opencontainers.image.revision="${BUILD_VERSION}"
RUN groupmod -n dex node && usermod -l dex -d /home/dex -m node
WORKDIR /app
COPY --from=build /build/dist ./dist
COPY --from=build /build/node_modules ./node_modules
COPY package.json ./
COPY prompts/ ./prompts/
COPY config/ ./dist/config/
RUN ln -s ../prompts dist/prompts
USER dex
HEALTHCHECK --interval=30s --timeout=6s --start-period=90s --retries=3 CMD node dist/health.js || exit 1
CMD ["node", "dist/src/index.js"]
