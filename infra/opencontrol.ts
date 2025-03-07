import { database } from "./planetscale";

export const server = new sst.aws.OpenControl("OpenControl", {
  server: {
    handler: "packages/backend/src/function/opencontrol/server.handler",
    link: [database],
  },
});

export const outputs = {
  openControl: server.url,
};
