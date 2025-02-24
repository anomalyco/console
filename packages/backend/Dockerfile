FROM mirror.gcr.io/oven/bun:1.2

ADD ./package.json .
ADD ./bun.lock .
ADD ./packages/core/package.json ./packages/core/package.json
ADD ./packages/backend/package.json ./packages/backend/package.json
ADD ./packages/mail/package.json ./packages/mail/package.json
ADD ./patches ./patches
RUN bun install --ignore-scripts

ADD ./packages/backend ./packages/backend
ADD ./packages/core ./packages/core
ADD ./packages/mail ./packages/mail

WORKDIR ./packages/backend
CMD ["bun", "run", "./src/index.ts"]

