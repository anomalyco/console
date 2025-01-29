/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "console",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
          profile: input.stage === "production" ? "sst-production" : "sst-dev",
        },
        planetscale: "0.0.7",
      },
    };
  },
  console: {
    autodeploy: {
      target(input) {
        if (input.type === "branch") {
          return {
            stage: input.branch,
            runner: {
              engine: "codebuild",
              compute: "large",
            },
          };
        }
      },
      async workflow({ $, event }) {
        await $`npm i -g bun`;
        await $`bun i`;
        await $`docker buildx create --driver docker-container --driver-opt image=mirror.gcr.io/moby/buildkit --name sst-builder`;
        await $`BUILDX_BUILDER=sst-builder bun sst deploy`;
      },
    },
  },
  async run() {
    await import("./infra/dns");
    await import("./infra/cluster");
    await import("./infra/network");
    await import("./infra/planetscale");
    await import("./infra/websocket");
    await import("./infra/postgres");
    await import("./infra/bus");
    await import("./infra/event");
    await import("./infra/email");
    await import("./infra/alerts");
    await import("./infra/storage");
    await import("./infra/auth");
    await import("./infra/api");
    await import("./infra/web");
    await import("./infra/issues");
    await import("./infra/autodeploy");
    await import("./infra/billing");
    await import("./infra/cluster");
  },
});
