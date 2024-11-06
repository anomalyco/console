import { withActor } from "@console/core/actor";
import { app, stage } from "@console/core/app/app.sql";
import { awsAccount } from "@console/core/aws/aws.sql";
import { State } from "@console/core/state";
import { createId } from "@console/core/util/sql";
import {
  createTransaction,
  createTransactionEffect,
  useTransaction,
} from "@console/core/util/transaction";
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
    evt.detail.object.key.startsWith("update") &&
    evt["detail-type"] === "Object Created"
  ) {
    let [, appHint, stageHint] = evt.detail.object.key.split("/");
    [stageHint] = stageHint!.split(".");
    await useTransaction(async (tx) => {
      const stages = await findStages(
        stageHint!,
        appHint!,
        evt.account,
        region,
      );
      for (const row of stages) {
        await withActor(
          {
            type: "system",
            properties: {
              workspaceID: row.workspaceID,
            },
          },
          () =>
            createTransaction(async () => {
              if (!row.appID) {
                row.appID = createId();
                await tx.insert(app).values({
                  workspaceID: row.workspaceID,
                  name: appHint!,
                  id: row.appID,
                });
              }
              if (!row.stageID) {
                row.stageID = createId();
                await tx.insert(stage).values({
                  appID: row.appID!,
                  name: stageHint!,
                  id: row.stageID,
                  region: evt.region,
                  workspaceID: row.workspaceID,
                  awsAccountID: row.id,
                });
              }
              await createTransactionEffect(() =>
                bus.publish(Resource.Bus, State.Event.UpdateCreated, {
                  stageID: row.stageID!,
                  updateID: evt.detail.object.key
                    .split("/")
                    .at(-1)!
                    .split(".")[0]!,
                }),
              );
            }),
        );
      }
    });
  }

  if (
    evt["detail-type"] === "Object Created" &&
    evt.detail.object.key.startsWith("snapshot")
  ) {
    let [, appHint, stageHint, updateID] = evt.detail.object.key.split("/");
    updateID = updateID!.split(".")[0]!;
    const stages = await findStages(stageHint!, appHint!, evt.account, region);
    for (const row of stages) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        () =>
          bus.publish(Resource.Bus, State.Event.SnapshotCreated, {
            stageID: row.stageID!,
            updateID,
          }),
      );
    }
    return;
  }

  if (
    evt["detail-type"] === "Object Created" &&
    evt.detail.object.key.startsWith("app")
  ) {
    let [, appHint, stageHint] = evt.detail.object.key.split("/");
    stageHint = stageHint!.split(".")[0];
    const stages = await findStages(stageHint!, appHint!, evt.account, region);
    for (const row of stages) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        () =>
          bus.publish(Resource.Bus, State.Event.StateUpdated, {
            stageID: row.stageID!,
          }),
      );
    }
    return;
  }

  // this is legacy now :(
  if (evt.detail.object.key.startsWith("lock")) {
    if (evt["detail-type"] === "Object Created") {
      console.log("lock created");
      await useTransaction(async (tx) => {
        let [, appHint, stageHint] = evt.detail.object.key.split("/");
        [stageHint] = stageHint!.split(".");
        const stages = await findStages(
          stageHint!,
          appHint!,
          evt.account,
          region,
        );
        for (const row of stages) {
          await withActor(
            {
              type: "system",
              properties: {
                workspaceID: row.workspaceID,
              },
            },
            () =>
              createTransaction(async () => {
                if (!row.appID) {
                  row.appID = createId();
                  await tx.insert(app).values({
                    workspaceID: row.workspaceID,
                    name: appHint!,
                    id: row.appID,
                  });
                }

                if (!row.stageID) {
                  row.stageID = createId();
                  await tx.insert(stage).values({
                    appID: row.appID!,
                    name: stageHint!,
                    id: row.stageID,
                    region: evt.region,
                    workspaceID: row.workspaceID,
                    awsAccountID: row.id,
                  });
                }
                console.log("lock created for", row);
                await createTransactionEffect(() =>
                  bus.publish(Resource.Bus, State.Event.LockCreated, {
                    stageID: row.stageID!,
                    // @ts-expect-error
                    versionID: evt.detail.object["version-id"]!,
                  }),
                );
              }),
          );
        }
      });
      return;
    }
  }

  // this is legacy now :(
  if (evt.detail.object.key.startsWith("summary")) {
    let [, appHint, stageHint, updateID] = evt.detail.object.key.split("/");
    updateID = updateID!.split(".")[0];
    const stages = await findStages(stageHint!, appHint!, evt.account, region);
    for (const row of stages) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        () =>
          bus.publish(Resource.Bus, State.Event.SummaryCreated, {
            stageID: row.stageID!,
            updateID: updateID!,
          }),
      );
    }
    return;
  }

  // this is legacy now :(
  if (
    evt["detail-type"] === "Object Created" &&
    evt.detail.object.key.startsWith("history")
  ) {
    let [, appHint, stageHint, updateID] = evt.detail.object.key.split("/");
    updateID = updateID!.split(".")[0];
    const stages = await findStages(stageHint!, appHint!, evt.account, region);
    for (const row of stages) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        () =>
          bus.publish(Resource.Bus, State.Event.HistoryCreated, {
            stageID: row.stageID!,
            key: evt.detail.object.key,
          }),
      );
    }
    return;
  }

  // this is v2
  if (
    evt["detail-type"] === "Object Created" ||
    evt["detail-type"] === "Object Deleted"
  ) {
    if (!evt.detail.object.key.startsWith("stackMetadata")) {
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
    const rows = await findStages(stageName!, appName!, account, region);
    for (const row of rows) {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: row.workspaceID,
          },
        },
        () =>
          createTransaction(async (tx) => {
            if (!row.appID) {
              row.appID = createId();
              await tx.insert(app).values({
                workspaceID: row.workspaceID,
                name: appHint!,
                id: row.appID,
              });
            }
            if (!row.stageID) {
              row.stageID = createId();
              await tx.insert(stage).values({
                appID: row.appID!,
                name: stageHint!,
                id: row.stageID,
                region: evt.region,
                workspaceID: row.workspaceID,
                awsAccountID: row.id,
              });
            }
            await createTransactionEffect(() =>
              bus.publish(Resource.Bus, State.Event.StateUpdated, {
                stageID: row.stageID!,
              }),
            );
          }),
      );
    }
  }
};

async function findStages(
  stageName: string,
  appName: string,
  account: string,
  region: string,
) {
  const rows = await useTransaction((tx) => {
    return tx
      .select({
        workspaceID: awsAccount.workspaceID,
        stageID: stage.id,
        appID: app.id,
        id: awsAccount.id,
      })
      .from(awsAccount)
      .leftJoin(
        app,
        and(
          eq(app.name, appName!),
          eq(app.workspaceID, awsAccount.workspaceID),
        ),
      )
      .leftJoin(
        stage,
        and(
          eq(stage.name, stageName!),
          eq(stage.appID, app.id),
          eq(stage.region, region),
        ),
      )
      .where(and(eq(awsAccount.accountID, account)))
      .execute();
  });
  console.log("matches", rows);
  return rows;
}
