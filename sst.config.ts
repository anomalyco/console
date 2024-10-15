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
  async run() {
    await import("./infra/dns");
    await import("./infra/planetscale");
    await import("./infra/email");
    await import("./infra/alerts");
    await import("./infra/storage");
    await import("./infra/auth");
  },
});
