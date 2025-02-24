import { Stage } from "@console/core/app/stage";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { chunk } from "remeda";
import { createId } from "@console/core/util/sql";
import { useTransaction } from "@console/core/util/transaction";
import { stage } from "@console/core/app/app.sql";
import { and, asc, eq, gt, isNull, or } from "@console/core/drizzle/index";
import { workspace } from "@console/core/workspace/workspace.sql";
import { stripeTable } from "@console/core/billing/billing.sql";

const sqs = new SQSClient({});
export async function handler() {
  await handleInvocationsPricing();
  await handleResourcesPricing();
}

async function handleInvocationsPricing() {
  let cursor: string | undefined;

  const listStages = async function (cursor?: string) {
    return await useTransaction(async (tx) => {
      const SIZE = 100000;
      const items = await tx
        .select({
          stageID: stage.id,
          workspaceID: stage.workspaceID,
        })
        .from(stage)
        .innerJoin(stripeTable, eq(stripeTable.workspaceID, stage.workspaceID))
        .where(
          and(
            eq(stripeTable.priceID, Resource.StripeInvocationsPriceID.value),
            cursor ? gt(stage.id, cursor) : undefined,
          ),
        )
        .limit(SIZE)
        .orderBy(asc(stage.id))
        .execute()
        .then((rows) => rows);
      return {
        items,
        cursor: items.length < SIZE ? undefined : items.at(-1)?.stageID,
      };
    });
  };

  do {
    const ret = await listStages(cursor);
    const stages = ret.items;
    cursor = ret.cursor;

    console.log("stages", stages.length);
    let index = 0;
    for (const stage of chunk(stages, 10)) {
      await sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: Resource.BillingQueue.url,
          Entries: stage.map((stage) => ({
            Id: createId(),
            MessageDeduplicationId: createId(),
            MessageBody: JSON.stringify({
              price: "invocations",
              stageID: stage.stageID,
              workspaceID: stage.workspaceID,
            }),
            MessageGroupId: (index++ % 10).toString(),
          })),
        }),
      );
    }
  } while (cursor !== undefined);
}

async function handleResourcesPricing() {
  let cursor: string | undefined;

  const listWorkspaces = async function (cursor?: string) {
    return await useTransaction(async (tx) => {
      const SIZE = 100000;
      const items = await tx
        .select({
          workspaceID: workspace.id,
        })
        .from(workspace)
        .innerJoin(stripeTable, eq(stripeTable.workspaceID, workspace.id))
        .where(
          and(
            or(
              isNull(stripeTable.priceID),
              eq(stripeTable.priceID, Resource.StripeResourcesPriceID.value),
            ),
            cursor ? gt(workspace.id, cursor) : undefined,
          ),
        )
        .limit(SIZE)
        .orderBy(asc(workspace.id))
        .execute()
        .then((rows) => rows);
      return {
        items,
        cursor: items.length < SIZE ? undefined : items.at(-1)?.workspaceID,
      };
    });
  };

  do {
    const ret = await listWorkspaces(cursor);
    const workspaces = ret.items;
    cursor = ret.cursor;

    console.log("workspaces", workspaces.length);
    let index = 0;
    for (const workspace of chunk(workspaces, 10)) {
      await sqs.send(
        new SendMessageBatchCommand({
          QueueUrl: Resource.BillingQueue.url,
          Entries: workspace.map((workspace) => ({
            Id: createId(),
            MessageDeduplicationId: createId(),
            MessageBody: JSON.stringify({
              price: "resources",
              workspaceID: workspace.workspaceID,
            }),
            MessageGroupId: (index++ % 10).toString(),
          })),
        }),
      );
    }
  } while (cursor !== undefined);
}
