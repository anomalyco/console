import { withActor } from "@console/core/actor";
import { Stage } from "@console/core/app";
import { Issue } from "@console/core/issue";
import { EventHandler } from "sst/node/event-bus";

export const handler = EventHandler(Issue.Events.RateLimited, (evt) =>
  withActor(evt.metadata.actor, async () => {
    const config = await Stage.assumeRole(evt.properties.stageID);
    if (!config) return;
    await Issue.disableLogGroup({
      logGroup: evt.properties.logGroup,
      config,
    });
  }),
);
