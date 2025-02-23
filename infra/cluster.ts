import { vpc } from "./network";

export const cluster = new sst.aws.Cluster("Cluster", {
  vpc,
});
