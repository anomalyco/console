import { readFileSync } from "fs";
import { vpc } from "./network";
import { database } from "./planetscale";
import { postgres } from "./postgres";
import { domain } from "./dns";
import { isPermanent } from "./stage";
import { storage } from "./storage";

export const cluster = new sst.aws.Cluster("Cluster", {
  vpc,
});
