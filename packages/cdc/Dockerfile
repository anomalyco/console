from mirror.gcr.io/oven/bun:latest

copy ./package.json .
copy ./packages/core/package.json ./packages/core/
copy ./packages/cdc/package.json ./packages/cdc/
copy ./packages/mail/package.json ./packages/mail/
copy ./patches/*.patch ./patches/

# do not run scripts
run bun install --frozen-lockfile --ignore-scripts

copy ./packages/core/src ./packages/core/src
copy ./packages/cdc/src ./packages/cdc/src

entrypoint ["bun", "run", "./packages/cdc/src/index.ts"]

