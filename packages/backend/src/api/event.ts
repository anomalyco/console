import { withActor } from "@console/core/actor";
import { Alert } from "@console/core/alert/index";
import { App } from "@console/core/app/index";
import { Stage } from "@console/core/app/stage";
import { AWS } from "@console/core/aws/index";
import { Stripe } from "@console/core/billing/stripe";
import { EmailOctopus } from "@console/core/email-octopus/index";
import { Issue } from "@console/core/issue/index";
import { Run } from "@console/core/run/index";
import { State } from "@console/core/state/index";
import {
  stateReceiveEventLog,
  stateReceiveSnapshot,
} from "@console/core/state/pg";
import { User } from "@console/core/user/index";
import { Workspace } from "@console/core/workspace/index";
import { EventBridgeEvent } from "aws-lambda";
import { Hono } from "hono";
import { event } from "sst/event";

const subscriptions: {
  events: string[];
  cb: (input: any, raw: EventBridgeEvent<string, any>) => Promise<void>;
}[] = [];

export const EventRoute = new Hono().post("/", async (c) => {
  const json = await c.req.json();
  for (const { events, cb } of subscriptions) {
    for (const event of events) {
      if (json["detail-type"] === event) {
        await withActor(json.detail.metadata.actor, async () => {
          await cb(json.detail, json);
        });
      }
    }
  }
  return c.text("ok");
});

function subscribe<Events extends event.Definition>(
  input: Events | Events[],
  cb: (
    input: {
      [K in Events["type"]]: Extract<
        Events,
        {
          type: K;
        }
      >["$payload"];
    }[Events["type"]],
    raw: EventBridgeEvent<string, any>,
  ) => Promise<void>,
) {
  subscriptions.push({
    events: Array.isArray(input) ? input.map((x) => x.type) : [input.type],
    cb,
  });
}

subscribe(User.Events.UserCreated, async (input) => {
  await User.sendEmailInvite(input.properties.userID);
  await EmailOctopus.subscribe({
    userID: input.properties.userID,
  });
});

subscribe(AWS.Account.Events.Created, async (input) => {
  const account = await AWS.Account.fromID(input.properties.awsAccountID);
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
});

subscribe(Workspace.Events.Created, async (input) => {
  await withActor(
    {
      type: "system",
      properties: {
        workspaceID: input.properties.workspaceID,
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
});

subscribe(AWS.Account.Events.Removed, async (input) => {
  await AWS.Account.disconnect(input.properties.awsAccountID);
});

subscribe(State.Event.SummaryCreated, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await State.receiveSummary({
    updateID: input.properties.updateID,
    config,
  });
});

subscribe(State.Event.HistoryCreated, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await State.receiveHistory({
    key: input.properties.key,
    config,
  });
});

subscribe(State.Event.UpdateCreated, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await State.receiveUpdate({
    config,
    updateID: input.properties.updateID,
  });
});

subscribe(State.Event.SnapshotCreated, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await stateReceiveSnapshot({
    config,
    updateID: input.properties.updateID,
  });
});

subscribe(
  [
    App.Stage.Events.Updated,
    App.Stage.Events.Connected,
    State.Event.StateUpdatedV2,
    State.Event.StateUpdated,
  ],
  async (input) => {
    const config = await Stage.assumeRole(input.properties.stageID);
    if (!config) return;
    await State.refreshState({
      config,
    });
  },
);

subscribe(State.Event.EventLogCreated, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await stateReceiveEventLog({
    config,
    updateID: input.properties.updateID,
  });
});

subscribe(State.Event.StateRefreshed, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await Issue.subscribeIon(config);
});

subscribe(Issue.Events.RateLimited, async (input) => {
  const config = await Stage.assumeRole(input.properties.stageID);
  if (!config) return;
  await Issue.disableLogGroup({
    logGroup: input.properties.logGroup,
    config,
  });
});

subscribe(Issue.Events.IssueDetected, async (input) => {
  await Issue.Send.triggerIssue(input.properties);
});

subscribe(Run.Event.Created, async (input) => {
  await Run.orchestrate({
    appID: input.properties.appID,
    stageName: input.properties.stageName,
    region: input.properties.region,
    awsAccountExternalID: input.properties.awsAccountExternalID,
  });
});

subscribe(Run.Event.CreateFailed, async (input) => {
  await Run.alert(input.properties.runID);
});
