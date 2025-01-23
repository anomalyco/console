import { vpc } from "./network";
import { database } from "./planetscale";
import { postgres } from "./postgres";

export const cluster = new sst.aws.Cluster("Cluster", {
  vpc,
});

cluster.addService("CDC", {
  image: {
    context: ".",
    dockerfile: "./packages/cdc/Dockerfile",
  },
  environment: {
    NO_COLOR: "1",
  },
  link: [postgres, database],
  dev: {
    directory: "./packages/cdc",
    command: "bun run --hot ./src/index.ts",
  },
});
