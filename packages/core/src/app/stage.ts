import { createSelectSchema } from "drizzle-zod";
import { app, resource, stage } from "./app.sql";
import { z } from "zod";
import { zod } from "../util/zod";
import {
  createTransaction,
  createTransactionEffect,
  useTransaction,
} from "../util/transaction";
import { createId } from "@paralleldrive/cuid2";
import { useWorkspace } from "../actor";
import { awsAccount } from "../aws/aws.sql";
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { AWS } from "../aws";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Enrichers, Resource } from "./resource";
import { db } from "../drizzle";
import { createEvent } from "../event";
import { Replicache } from "../replicache";
import { issueSubscriber } from "../issue/issue.sql";
import { bus } from "sst/aws/bus";
import { Resource as SSTResource } from "sst";
import { State } from "../state";
export * as Stage from "./stage";

export const Events = {
  Connected: createEvent(
    "app.stage.connected",
    z.object({
      stageID: z.string().min(1),
    }),
  ),
  Updated: createEvent(
    "app.stage.updated",
    z.object({
      stageID: z.string().min(1),
    }),
  ),
  ResourcesUpdated: createEvent(
    "app.stage.resources_updated",
    z.object({
      stageID: z.string().min(1),
    }),
  ),
  UsageRequested: createEvent(
    "app.stage.usage_requested",
    z.object({
      stageID: z.string().min(1),
      daysOffset: z.number().int().min(1),
    }),
  ),
};

export const Info = createSelectSchema(stage, {
  id: (schema) => schema.id.cuid2(),
  name: (schema) => schema.name.trim().min(1),
  appID: (schema) => schema.appID.cuid2(),
  workspaceID: (schema) => schema.workspaceID.cuid2(),
  region: (schema) => schema.region.trim().min(1),
  awsAccountID: (schema) => schema.awsAccountID.cuid2(),
});
export type Info = z.infer<typeof Info>;

export const fromID = zod(Info.shape.id, (stageID) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(stage)
      .where(and(eq(stage.workspaceID, useWorkspace()), eq(stage.id, stageID)))
      .execute()
      .then((x) => x[0]),
  ),
);

export const fromName = zod(
  Info.pick({
    appID: true,
    name: true,
    region: true,
    awsAccountID: true,
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .select()
        .from(stage)
        .where(
          and(
            eq(stage.workspaceID, useWorkspace()),
            eq(stage.name, input.name),
            eq(stage.region, input.region),
            eq(stage.appID, input.appID),
            eq(stage.awsAccountID, input.awsAccountID),
            isNull(stage.timeDeleted),
          ),
        )
        .execute()
        .then((x) => x[0]),
    ),
);

export const put = zod(
  z.object({
    stageName: z.string(),
    appName: z.string(),
    region: z.string(),
    awsAccountID: z.string().cuid2(),
  }),
  (input) =>
    useTransaction(async (tx) => {
      const workspaceID = useWorkspace();
      let appID = createId();
      await tx.insert(app).ignore().values({
        workspaceID,
        name: input.appName,
        id: appID,
      });
      appID = await tx
        .select({ id: app.id })
        .from(app)
        .where(
          and(eq(app.workspaceID, workspaceID), eq(app.name, input.appName)),
        )
        .execute()
        .then((x) => x.at(0)!.id);
      let stageID = createId();
      await tx.insert(stage).ignore().values({
        workspaceID,
        appID,
        name: input.stageName,
        region: input.region,
        id: stageID,
        awsAccountID: input.awsAccountID,
      });
      stageID = await tx
        .select({ id: stage.id })
        .from(stage)
        .where(
          and(
            eq(stage.workspaceID, workspaceID),
            eq(stage.appID, appID),
            eq(stage.name, input.stageName),
            eq(stage.region, input.region),
            eq(stage.awsAccountID, input.awsAccountID),
          ),
        )
        .execute()
        .then((x) => x.at(0)!.id);
      return { appID, stageID };
    }),
);

export const list = zod(
  z.object({
    cursor: z.string().min(1).optional(),
  }),
  ({ cursor }) =>
    useTransaction(async (tx) => {
      const SIZE = 100000;
      const items = await tx
        .select()
        .from(stage)
        .where(cursor ? gt(stage.id, cursor) : undefined)
        .limit(SIZE)
        .orderBy(asc(stage.id))
        .execute()
        .then((rows) => rows);
      return {
        items,
        cursor: items.length < SIZE ? undefined : items.at(-1)?.id,
      };
    }),
);

export type StageCredentials = Exclude<
  Awaited<ReturnType<typeof assumeRole>>,
  undefined
>;

export const assumeRole = zod(Info.shape.id, async (stageID) => {
  const result = await useTransaction((tx) =>
    tx
      .select({
        accountID: awsAccount.accountID,
        region: stage.region,
        name: stage.name,
        app: app.name,
      })
      .from(awsAccount)
      .innerJoin(stage, eq(stage.awsAccountID, awsAccount.id))
      .innerJoin(app, eq(stage.appID, app.id))
      .where(and(eq(stage.id, stageID), eq(stage.workspaceID, useWorkspace())))
      .execute()
      .then((rows) => rows.at(0)),
  );
  if (!result) return;
  const credentials = await AWS.assumeRole(result.accountID);
  if (!credentials) return;
  return {
    credentials,
    region: result.region,
    stageID,
    stage: result.name,
    app: result.app,
    awsAccountID: result.accountID,
  };
});

export const remove = zod(Info.shape.id, (stageID) =>
  createTransaction(
    async (tx) => {
      console.log("removing stage", stageID);
      await tx
        .update(stage)
        .set({
          timeDeleted: sql`CURRENT_TIMESTAMP(3)`,
        })
        .where(
          and(eq(stage.id, stageID), eq(stage.workspaceID, useWorkspace())),
        )
        .execute();
      await tx
        .delete(resource)
        .where(
          and(
            eq(resource.stageID, stageID),
            eq(resource.workspaceID, useWorkspace()),
          ),
        )
        .execute();
      await tx
        .delete(issueSubscriber)
        .where(
          and(
            eq(issueSubscriber.stageID, stageID),
            eq(issueSubscriber.workspaceID, useWorkspace()),
          ),
        )
        .execute();
      await createTransactionEffect(() => Replicache.poke());
    },
    {
      isolationLevel: "read uncommitted",
    },
  ),
);

function parseVersion(input: string) {
  return input
    .split(".")
    .map((item) => parseInt(item))
    .reduce((acc, val, i) => acc + val * Math.pow(1000, 2 - i), 0);
}
const MINIMUM_VERSION = parseVersion("2.19.2");
