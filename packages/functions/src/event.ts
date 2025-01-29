import { withActor } from "@console/core/actor";
import { Alert } from "@console/core/alert/index";
import { App, Stage } from "@console/core/app/index";
import { AWS } from "@console/core/aws/index";
import { Stripe } from "@console/core/billing/stripe";
import { Issue } from "@console/core/issue/index";
import { Run } from "@console/core/run/index";
import { State } from "@console/core/state/index";
import { stateReceiveEventLog } from "@console/core/state/pg";
import { User } from "@console/core/user/index";
import { Workspace } from "@console/core/workspace/index";
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
    State.Event.StateRefreshed,
    State.Event.EventLogCreated,
    State.Event.SnapshotCreated,
    State.Event.StateUpdated,
    State.Event.UpdateCreated,
    Workspace.Events.Created,
    Stage.Events.ResourcesUpdated,
    Issue.Events.RateLimited,
    Issue.Events.IssueDetected,
    Run.Event.Created,
    Run.Event.CreateFailed,
    User.Events.UserCreated,
  ],
  async (evt) =>
    withActor(evt.metadata.actor, async () => {
      console.log(JSON.stringify(evt));
      const now = Date.now();
      switch (evt.type) {
        case User.Events.UserCreated.type:
          await User.sendEmailInvite(evt.properties.userID);
          break;
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
          await withActor(
            {
              type: "system",
              properties: {
                workspaceID: evt.properties.workspaceID,
              },
            },
            async () => {
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
            },
          );
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

        case State.Event.EventLogCreated.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await stateReceiveEventLog({
            config,
            updateID: evt.properties.updateID,
          });
          break;
        }

        case State.Event.StateRefreshed.type: {
          const config = await Stage.assumeRole(evt.properties.stageID);
          if (!config) return;
          await Issue.subscribeIon(config);
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
          await Run.orchestrate({
            stageName: evt.properties.stageName,
            region: evt.properties.region,
            awsAccountExternalID: evt.properties.awsAccountExternalID,
          });
          break;
        }

        case Run.Event.CreateFailed.type: {
          await Run.alert(evt.properties.runID);
          break;
        }
      }
      const duration = Date.now() - now;
      console.log(
        JSON.stringify({
          _aws: {
            Timestamp: new Date().getTime(),
            CloudWatchMetrics: [
              {
                Namespace: "console",
                Dimensions: [["type"]],
                Metrics: [
                  {
                    Name: "event_duration",
                    Unit: "Milliseconds",
                  },
                ],
              },
            ],
          },
          type: evt.type,
          event_duration: duration,
        }),
      );
    }),
);
