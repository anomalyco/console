import { withActor } from "@console/core/actor";
import { Alert } from "@console/core/alert";
import { App, Stage } from "@console/core/app";
import { AWS } from "@console/core/aws";
import { Billing } from "@console/core/billing";
import { Stripe } from "@console/core/billing/stripe";
import { Issue } from "@console/core/issue";
import { Run } from "@console/core/run";
import { State } from "@console/core/state";
import { stripe } from "@console/core/stripe";
import { Workspace } from "@console/core/workspace";
import { bus } from "sst/aws/bus";

export const handler = bus.subscriber(
  [
    AWS.Account.Events.Created,
    AWS.Account.Events.Removed,
    App.Stage.Events.Connected,
    App.Stage.Events.Updated,
    App.Stage.Events.ResourcesUpdated,
    State.Event.SummaryCreated,
    State.Event.HistoryCreated,
    State.Event.HistorySynced,
    State.Event.SnapshotCreated,
    State.Event.StateUpdated,
    State.Event.UpdateCreated,
    Workspace.Events.Created,
    Stage.Events.ResourcesUpdated,
    Issue.Events.RateLimited,
    Issue.Events.IssueDetected,
    Run.Event.Created,
    Run.Event.CreateFailed,
    Run.Event.Completed,
  ],
  async (evt) =>
    withActor(evt.metadata.actor, async () => {
      console.log(evt.type);
      console.log(evt);
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

        case Workspace.Events.Created.type:
          await Alert.put({
            source: { app: "*", stage: "*" },
            destination: {
              type: "email",
              properties: { users: "*" },
            },
            event: "issue",
          });
          await Alert.put({
            source: { app: "*", stage: "*" },
            destination: {
              type: "email",
              properties: { users: "*" },
            },
            event: "autodeploy",
          });
          await Stripe.createCustomer();
          break;

        case AWS.Account.Events.Removed.type:
          await AWS.Account.disconnect(evt.properties.awsAccountID);
          break;

        case State.Event.SummaryCreated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await State.receiveSummary({
            updateID: evt.properties.updateID,
            config,
          });
          break;
        }

        case State.Event.HistoryCreated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await State.receiveHistory({
            key: evt.properties.key,
            config,
          });
          break;
        }

        case State.Event.UpdateCreated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await State.receiveUpdate({
            config,
            updateID: evt.properties.updateID,
          });
          break;
        }

        case State.Event.SnapshotCreated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await State.receiveSnapshot({
            config,
            updateID: evt.properties.updateID,
          });
          break;
        }

        case App.Stage.Events.Updated.type:
        case App.Stage.Events.Connected.type:
        case State.Event.StateUpdated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await State.refreshState({
            config,
          });
          break;
        }

        case Issue.Events.RateLimited.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await Issue.disableLogGroup({
            logGroup: evt.properties.logGroup,
            config,
          });
          break;
        }

        case Issue.Events.IssueDetected.type: {
          await Issue.Send.triggerIssue(evt.properties);
          break;
        }

        case Run.Event.Created.type: {
          await Run.orchestrate(evt.properties.stageID);
          break;
        }

        case Run.Event.CreateFailed.type: {
          await Run.alert(evt.properties.runID);
          break;
        }

        case Run.Event.Completed.type: {
          await Run.orchestrate(evt.properties.stageID);
          await Run.alert(evt.properties.runID);
          break;
        }
      }
    }),
);
