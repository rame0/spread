FROM node:22
WORKDIR /app

RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm && rm -rf /root/.npm


COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter append-only

COPY . .
RUN pnpm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
