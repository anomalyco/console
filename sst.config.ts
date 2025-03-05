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
        random: "4.17.0",
      },
    };
  },
  console: {
    autodeploy: {
      runner(input) {
        return {
          engine: "codebuild",
          compute: "large",
          vpc:
            input.stage === "production"
              ? {
                  id: "vpc-0f06c4b635a760100",
                  subnets: ["subnet-0af5c5640dfe75a22"],
                  securityGroups: ["sg-0f360ed3d2f363121"],
                }
              : {
                  id: "vpc-069d2d529d3288945",
                  subnets: ["subnet-0b50769394a27a57d"],
                  securityGroups: ["sg-038ad39edab8e193b"],
                },
        };
      },
    },
  },
  async run() {
    $transform(sst.aws.Function, (input) => {
      input.runtime = "nodejs22.x";
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
    const mcp = await import("./infra/mcp");

    return {
      ...mcp.outputs,
      bar: "ok",
    };
  },
});
