# Debian rather than Alpine: onnxruntime-node ships glibc binaries only.
FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter append-only

FROM deps AS build
WORKDIR /app

COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
# The expense categoriser runs on the CPU of this platform; other platforms' and GPU binaries are ~600 MB.
RUN pnpm run build && pnpm prune --prod \
  && find node_modules/.pnpm -path '*/onnxruntime-node/bin/napi-v*/*' -maxdepth 6 -type d \( -name darwin -o -name win32 \) -prune -exec rm -rf {} + \
  && find node_modules/.pnpm -path '*/onnxruntime-node/bin/*' \( -name 'libonnxruntime_providers_cuda.so' -o -name 'libonnxruntime_providers_tensorrt.so' \) -delete

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY models ./models
COPY certs ./certs

USER app
EXPOSE 3001

CMD ["node", "dist/index.js"]
