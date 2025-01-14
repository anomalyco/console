import { Stage } from "@console/core/app";
import { Issue } from "@console/core/issue";
import { State } from "@console/core/state";
import { MySQLBackend } from "@openauthjs/openevent/backend/mysql";
import { createProcessor } from "@openauthjs/openevent/processor";
import { Resource } from "sst";

export const processor = createProcessor({
  backend: MySQLBackend({
    host: Resource.Database.host,
    port: Resource.Database.port,
    user: Resource.Database.username,
    password: Resource.Database.password,
    ssl: {
      rejectUnauthorized: true,
    },
  }),
}).handle({
  name: "log.subscribe",
  event: State.Event.StateRefreshed,
  attempts: 3,
  fn: async (ctx, evt) => {
    const config = await Stage.assumeRole(evt.properties.stageID);
    if (!config) return;
    await Issue.subscribeIon(config);
  },
});
