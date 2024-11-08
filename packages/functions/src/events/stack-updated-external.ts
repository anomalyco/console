import { withActor } from "@console/core/actor";
import { Stage } from "@console/core/app/stage";
import { awsAccount } from "@console/core/aws/aws.sql";
import { State } from "@console/core/state";
import { useTransaction } from "@console/core/util/transaction";
import { and, eq } from "drizzle-orm";
import { Resource } from "sst";
import { bus } from "sst/aws/bus";

interface Events {
  "Object Created": {
    bucket: {
      name: string;
    };
    object: {
      key: string;
    };
  };
}

type Payload = {
  [key in keyof Events]: {
    account: string;
    region: string;
    "detail-type": key;
    detail: Events[key];
  };
}[keyof Events];

export const handler = async (evt: Payload) => {
  console.log(evt);
  const region = evt.region;

  if (
    evt.detail.object.key.startsWith("update/") &&
    evt["detail-type"] === "Object Created"
  ) {
    let [, appHint, stageHint] = evt.detail.object.key.split("/");
    [stageHint] = stageHint!.split(".");
    const accounts = await findAccounts(evt.account);
    for (const row of accounts) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        async () => {
          const { stageID } = await Stage.put({
            stageName: stageHint!,
            appName: appHint!,
            region,
            awsAccountID: row.id,
          });
          await bus.publish(Resource.Bus, State.Event.UpdateCreated, {
            stageID,
            updateID: evt.detail.object.key.split("/").at(-1)!.split(".")[0]!,
          });
        },
      );
    }
  }

  if (
    evt["detail-type"] === "Object Created" &&
    evt.detail.object.key.startsWith("snapshot/")
  ) {
    let [, appHint, stageHint, updateID] = evt.detail.object.key.split("/");
    updateID = updateID!.split(".")[0]!;
    const accounts = await findAccounts(evt.account);
    for (const account of accounts) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: account.workspaceID,
          },
        },
        async () => {
          const { stageID } = await Stage.put({
            stageName: stageHint!,
            appName: appHint!,
            region,
            awsAccountID: account.id,
          });
          await bus.publish(Resource.Bus, State.Event.SnapshotCreated, {
            stageID,
            updateID,
          });
        },
      );
    }
    return;
  }

  if (
    evt["detail-type"] === "Object Created" &&
    evt.detail.object.key.startsWith("app/")
  ) {
    let [, appHint, stageHint] = evt.detail.object.key.split("/");
    stageHint = stageHint!.split(".")[0];
    const accounts = await findAccounts(evt.account);
    for (const row of accounts) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        async () => {
          const { stageID } = await Stage.put({
            stageName: stageHint!,
            appName: appHint!,
            region,
            awsAccountID: row.id,
          });
          await bus.publish(Resource.Bus, State.Event.StateUpdated, {
            stageID,
          });
        },
      );
    }
    return;
  }

  // this is legacy now :(
  if (evt.detail.object.key.startsWith("lock/")) {
    if (evt["detail-type"] === "Object Created") {
      let [, appHint, stageHint] = evt.detail.object.key.split("/");
      [stageHint] = stageHint!.split(".");
      const accounts = await findAccounts(evt.account);
      for (const row of accounts) {
        await withActor(
          {
            type: "system",
            properties: {
              workspaceID: row.workspaceID,
            },
          },
          async () => {
            const { stageID } = await Stage.put({
              stageName: stageHint!,
              appName: appHint!,
              region,
              awsAccountID: row.id,
            });
            await bus.publish(Resource.Bus, State.Event.LockCreated, {
              stageID,
              // @ts-expect-error
              versionID: evt.detail.object["version-id"]!,
            });
          },
        );
      }
      return;
    }
  }

  // this is legacy now :(
  if (evt.detail.object.key.startsWith("summary/")) {
    let [, appHint, stageHint, updateID] = evt.detail.object.key.split("/");
    updateID = updateID!.split(".")[0];
    const accounts = await findAccounts(evt.account);
    for (const row of accounts) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        async () => {
          const { stageID } = await Stage.put({
            stageName: stageHint!,
            appName: appHint!,
            region,
            awsAccountID: row.id,
          });
          await bus.publish(Resource.Bus, State.Event.SummaryCreated, {
            stageID,
            updateID: updateID!,
          });
        },
      );
    }
    return;
  }

  // this is legacy now :(
  if (
    evt["detail-type"] === "Object Created" &&
    evt.detail.object.key.startsWith("history/")
  ) {
    let [, appHint, stageHint, updateID] = evt.detail.object.key.split("/");
    updateID = updateID!.split(".")[0];
    const stages = await findAccounts(evt.account);
    for (const row of stages) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        async () => {
          const { stageID } = await Stage.put({
            stageName: stageHint!,
            appName: appHint!,
            region,
            awsAccountID: row.id,
          });
          await bus.publish(Resource.Bus, State.Event.HistoryCreated, {
            stageID,
            key: evt.detail.object.key,
          });
        },
      );
    }
    return;
  }

  // this is v2
  if (
    evt["detail-type"] === "Object Created" ||
    evt["detail-type"] === "Object Deleted"
  ) {
    if (!evt.detail.object.key.startsWith("stackMetadata/")) {
      console.log("skipping", evt.detail.object.key);
      return;
    }
    const [, appHint, stageHint] = evt.detail.object.key.split("/");
    console.log({ appHint, stageHint });
    if (!stageHint || !appHint) return;
    let stageName = stageHint.endsWith(".json")
      ? stageHint.split(".")[0]
      : stageHint?.split(".").at(-1);
    const appName = appHint.includes(".")
      ? appHint?.split(".").at(-1)
      : appHint;
    const { account, region } = evt;
    console.log("processing", appName, stageName, account, region);
    const rows = await findAccounts(account);
    for (const row of rows) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        async () => {
          const { stageID } = await Stage.put({
            stageName: stageName!,
            appName: appName!,
            region,
            awsAccountID: row.id,
          });
          await bus.publish(Resource.Bus, State.Event.StateUpdated, {
            stageID,
          });
        },
      );
    }
  }
};

async function findAccounts(account: string) {
  const rows = await useTransaction((tx) => {
    return tx
      .select({
        workspaceID: awsAccount.workspaceID,
        id: awsAccount.id,
      })
      .from(awsAccount)
      .where(and(eq(awsAccount.accountID, account)))
      .execute();
  });
  return rows;
}
