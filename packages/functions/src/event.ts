import { withActor } from "@console/core/actor";
import { App, Stage } from "@console/core/app";
import { AWS } from "@console/core/aws";
import { State } from "@console/core/state";
import { bus } from "sst/aws/bus";

export const handler = bus.subscriber(
  [
    AWS.Account.Events.Created,
    AWS.Account.Events.Removed,
    App.Stage.Events.Connected,
    App.Stage.Events.ResourcesUpdated,
    State.Event.SummaryCreated,
    State.Event.HistoryCreated,
  ],
  async (evt) =>
    withActor(evt.metadata.actor, async () => {
      console.log("event", evt);
      switch (evt.type) {
        case AWS.Account.Events.Created.type:
          const account = await AWS.Account.fromID(evt.properties.awsAccountID);
          if (!account) {
            console.log("account not found");
            return;
          }
          const credentials = await AWS.assumeRole(account.accountID);
          if (!credentials) return;
          await AWS.Account.integrate({
            awsAccountID: account.id,
            credentials,
          });
          break;

        case AWS.Account.Events.Removed.type:
          await AWS.Account.disconnect(evt.properties.awsAccountID);
          break;

        case App.Stage.Events.Connected.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await Stage.syncMetadata({
            config,
          });
          break;
        }

        case State.Event.SummaryCreated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await State.receiveSummary({
            updateID: evt.properties.updateID,
            config,
          });
          break;
        }
      }
    }),
);
