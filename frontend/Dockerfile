# build stage
FROM node:18-alpine AS build-stage
WORKDIR /app
RUN npm install -g pnpm && rm -rf /root/.npm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter append-only && rm -rf /root/.pnpm

COPY . .
RUN pnpm run build

# production stage
FROM nginx:alpine AS production-stage
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/build /var/www/app
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
