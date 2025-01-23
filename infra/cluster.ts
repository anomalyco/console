import { vpc } from "./network";
import { postgres } from "./postgres";

export const cluster = new sst.aws.Cluster("Cluster", {
  vpc,
});

cluster.addService("CDC", {
  image: {
    context: ".",
    dockerfile: "./packages/cdc/Dockerfile",
  },
  link: [postgres, planetscale],
  dev: {
    directory: "./packages/cdc",
    command: "bun run --hot ./src/index.ts",
  },
});
