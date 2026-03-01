FROM node:22
WORKDIR /app

RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    sqlite3 \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10 && rm -rf /root/.npm


COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --reporter append-only

COPY tsconfig.json ./
COPY . .
RUN rm -rf dist && pnpm run build && ls -laR dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
