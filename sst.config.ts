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
        planetscale: "0.2.2",
        command: "1.0.2",
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
    },
  },
  async run() {
    const { vpc } = await import("./infra/network");
    $transform(sst.aws.Function, (args) => {
      args.vpc = vpc;
    });

    await import("./infra/dns");
    await import("./infra/cluster");
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
