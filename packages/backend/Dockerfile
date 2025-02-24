FROM mirror.gcr.io/oven/bun:1.2 AS builder

ADD ./package.json .
ADD ./bun.lock .
ADD ./packages/core/package.json ./packages/core/package.json
ADD ./packages/backend/package.json ./packages/backend/package.json
RUN bun install 

ADD ./packages/backend ./packages/backend
ADD ./packages/core ./packages/core

WORKDIR ./packages/backend
CMD ["bun", "run", "./src/index.ts"]

