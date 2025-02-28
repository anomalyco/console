import type { SQSEvent } from "aws-lambda";
import { DateTime } from "luxon";
import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { createId } from "@paralleldrive/cuid2";
import { withActor, useWorkspace } from "@console/core/actor";
import { Stage } from "@console/core/app/stage";
import { Billing } from "@console/core/billing/index";
import { stripe } from "@console/core/stripe/index";
import { Warning } from "@console/core/warning/index";
import { unique } from "remeda";
import { Workspace } from "@console/core/workspace/index";
import { usage } from "@console/core/billing/billing.sql";
import { and, desc, eq, inArray, sql } from "@console/core/drizzle/index";
import { useTransaction } from "@console/core/util/transaction";
import {
  stateCountTable,
  stateResourceTable,
} from "@console/core/state/state.sql";
import { Resource } from "sst";
import { disposable } from "@console/core/util/disposable";

export async function handler(event: SQSEvent) {
  console.log("got", event.Records.length, "records");
  for (const record of event.Records) {
    const evt = JSON.parse(record.body);
    console.log(record.body);
    await withActor(
      {
        type: "system",
        properties: {
          workspaceID: evt.workspaceID,
        },
      },
      async () => {
        if (evt.price === "invocations") {
          await processInvocations(evt.stageID);
        } else if (evt.price === "resources") {
          await processResources(evt.workspaceID);
        }
      },
    );
  }
}

async function processInvocations(stageID: string) {
  const stage = await Stage.fromID(stageID);
  if (stage?.unsupported) return;

  const workspace = await Workspace.fromID(useWorkspace());
  if (!workspace) return;

  // Start processing from the greater of
  // - the last processed day
  // - the workspace creation date
  const lastUsage = await useTransaction((tx) =>
    tx
      .select()
      .from(usage)
      .where(
        and(eq(usage.workspaceID, useWorkspace()), eq(usage.stageID, stageID)),
      )
      .orderBy(desc(usage.day))
      .limit(1)
      .execute()
      .then((x) => x[0]),
  );

  // Get stage credentials
  const config = await Stage.assumeRole(stageID);
  if (!config) {
    console.log("cannot assume role");
    await Warning.create({
      type: "permission_usage",
      target: stageID,
      stageID,
      data: {},
    });
    return;
  }

  // Get all function resources
  const allResources = await useTransaction((tx) =>
    tx
      .select()
      .from(stateResourceTable)
      .where(
        and(
          eq(stateResourceTable.workspaceID, useWorkspace()),
          eq(stateResourceTable.stageID, stageID),
          inArray(stateResourceTable.type, [
            "aws:lambda/function:Function",
            "sstv2:aws:Function",
          ]),
        ),
      )
      .execute(),
  );
  const functions = unique(
    allResources
      .flatMap((fn) =>
        (fn.type === "sstv2:aws:Function" && !fn.outputs?.enrichment?.live) ||
        (fn.type === "aws:lambda/function:Function" &&
          !fn.outputs?.description?.includes("live"))
          ? [fn.outputs.arn]
          : [],
      )
      // `arn` can be `null` for some reason, ie. {"id":"foo","arn":null,"code":null,...}
      .filter((item) => item)
      .map((item) => item.split(":").pop()!),
  );
  console.log(`> functions ${functions.length}/${allResources.length}`);
  if (!functions.length) {
    await Warning.remove({
      stageID,
      type: "permission_usage",
      target: stageID,
    });
    return;
  }
  console.log(functions);

  // Get AWS usage
  let startDate = (
    lastUsage
      ? DateTime.fromSQL(lastUsage.day)
      : DateTime.fromSQL(workspace.timeCreated).minus({ days: 1 })
  )
    .toUTC()
    .startOf("day");
  let endDate: DateTime;
  let hasChanges = false;

  while (true) {
    if (startDate.plus({ days: 1 }).endOf("day").diffNow().milliseconds > 0)
      break;
    startDate = startDate.plus({ days: 1 });
    endDate = startDate.endOf("day");

    console.log("STAGE", stageID, startDate.toSQLDate(), endDate.toSQLDate());

    // Get usage
    let invocations: number;
    try {
      invocations = await queryUsageFromAWS();
      await Warning.remove({
        stageID,
        type: "permission_usage",
        target: stageID,
      });
    } catch (e: any) {
      if (e.name === "AccessDenied" || e.name === "OptInRequired") {
        console.error(e);
        await Warning.create({
          type: "permission_usage",
          target: stageID,
          data: {},
          stageID,
        });
        await Billing.updateGatingStatus();
        return;
      }
      throw e;
    }
    hasChanges = hasChanges || invocations > 0;

    // Create usage
    await useTransaction((tx) =>
      tx
        .insert(usage)
        .values({
          id: createId(),
          workspaceID: useWorkspace(),
          stageID,
          day: startDate.toSQLDate()!,
          invocations,
        })
        .onDuplicateKeyUpdate({
          set: {
            invocations,
          },
        })
        .execute(),
    );

    async function queryUsageFromAWS() {
      using client = disposable(
        () => new CloudWatchClient(config!),
        (client) => client.destroy(),
      );

      const queryBatch = async (batch: typeof functions) => {
        const metrics = await client.send(
          new GetMetricDataCommand({
            MetricDataQueries: batch.map((fn, i) => ({
              Id: `m${i}`,
              MetricStat: {
                Metric: {
                  Namespace: "AWS/Lambda",
                  MetricName: "Invocations",
                  Dimensions: [
                    {
                      Name: "FunctionName",
                      Value: fn,
                    },
                  ],
                },
                Period: 86400,
                Stat: "Sum",
              },
            })),
            StartTime: startDate.toJSDate(),
            EndTime: endDate.toJSDate(),
          }),
        );
        return (metrics.MetricDataResults || [])?.reduce(
          (acc, result) => acc + (result.Values?.[0] ?? 0),
          0,
        );
      };

      // Query in batches
      let total = 0;
      const chunkSize = 500;
      for (let i = 0; i < functions.length; i += chunkSize) {
        total += await queryBatch(functions.slice(i, i + chunkSize));
      }
      console.log("> invocations", total);
      return total;
    }
  }

  if (hasChanges) await reportUsageToStripe();
  await Billing.updateGatingStatus();

  /////////////////
  // Functions
  /////////////////

  async function reportUsageToStripe() {
    const item = await Billing.Stripe.get();
    if (!item?.subscriptionItemID) return;
    if (item?.priceID !== Resource.StripeInvocationsPriceID.value) return;

    const monthlyInvocations = await Billing.countInvocationsByStartAndEndDay({
      startDay: startDate.startOf("month").toSQLDate()!,
      endDay: startDate.endOf("month").toSQLDate()!,
    });
    console.log("> monthly invocations", monthlyInvocations);

    try {
      const timestamp = endDate.toUnixInteger();
      await stripe.subscriptionItems.createUsageRecord(
        item.subscriptionItemID,
        {
          quantity: monthlyInvocations,
          timestamp,
          action: "set",
        },
        {
          idempotencyKey: `${useWorkspace()}-${stageID}-${timestamp}`,
        },
      );
    } catch (e: any) {
      console.log(e.message);
      // TODO: aren't there instanceof checks we can do
      if (e.message.startsWith("Keys for idempotent requests")) {
        return;
      }
      if (
        e.message.startsWith(
          "Cannot create the usage record with this timestamp",
        )
      ) {
        return;
      }
      throw e;
    }
  }
}

async function processResources(workspaceID: string) {
  const workspace = await Workspace.fromID(workspaceID);
  if (!workspace) return;

  const count = await Billing.countActiveResources();

  console.log(`workspace ${workspaceID} has ${count} resources`);

  if (count > 0) await reportUsageToStripe();
  await Billing.updateGatingStatus();

  /////////////////
  // Functions
  /////////////////

  async function reportUsageToStripe() {
    const item = await Billing.Stripe.get();
    if (!item?.subscriptionItemID) return;
    if (item?.priceID !== Resource.StripeResourcesPriceID.value) return;

    try {
      const timestamp = DateTime.utc().toUnixInteger();
      await stripe.subscriptionItems.createUsageRecord(
        item.subscriptionItemID,
        {
          quantity: count,
          timestamp,
          action: "set",
        },
        {
          idempotencyKey: `${useWorkspace()}-${timestamp}`,
        },
      );
    } catch (e: any) {
      console.log(e.message);
      // TODO: aren't there instanceof checks we can do
      if (e.message.startsWith("Keys for idempotent requests")) {
        return;
      }
      if (
        e.message.startsWith(
          "Cannot create the usage record with this timestamp",
        )
      ) {
        return;
      }
      throw e;
    }
  }
}
