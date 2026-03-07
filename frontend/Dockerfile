# build stage
FROM node:22-alpine AS build-stage
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter append-only && rm -rf /root/.pnpm

COPY . .
RUN pnpm run build

# production stage
FROM nginxinc/nginx-unprivileged:stable-alpine AS production-stage
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/dist /var/www/app
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
