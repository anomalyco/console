import type { SQSEvent } from "aws-lambda";
import { DateTime } from "luxon";
import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { withActor, useWorkspace } from "@console/core/actor";
import { Stage } from "@console/core/app/stage";
import { Resource } from "@console/core/app/resource";
import { Billing } from "@console/core/billing";
import { stripe } from "@console/core/stripe";
import { Warning } from "@console/core/warning";
import { uniq } from "remeda";
import { Workspace } from "@console/core/workspace";
import { usage } from "@console/core/billing/billing.sql";
import { and, desc, eq } from "drizzle-orm";
import { useTransaction } from "@console/core/util/transaction";

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
        const { stageID } = evt;

        // Check if stage is unsupported
        const stage = await Stage.fromID(stageID);
        if (stage?.unsupported) return;

        await processStage(stageID);
      }
    );
  }
}

async function processStage(stageID: string) {
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
        and(eq(usage.workspaceID, useWorkspace()), eq(usage.stageID, stageID))
      )
      .orderBy(desc(usage.day))
      .limit(1)
      .execute()
      .then((x) => x[0])
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
  const allResources = await Resource.listFromStageID({
    stageID,
    types: ["Function"],
  });
  const functions = uniq(
    allResources
      .flatMap((fn) =>
        fn.type === "Function" && !fn.enrichment.live ? [fn] : []
      )
      .map((resource) => resource.metadata.arn)
      .map((item) => item.split(":").pop()!)
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

    await Billing.createUsage({
      stageID,
      day: startDate.toSQLDate()!,
      invocations,
    });

    async function queryUsageFromAWS() {
      const client = new CloudWatchClient(config!);

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
          })
        );
        return (metrics.MetricDataResults || [])?.reduce(
          (acc, result) => acc + (result.Values?.[0] ?? 0),
          0
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

    const monthlyInvocations = await Billing.countByStartAndEndDay({
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
        }
      );
    } catch (e: any) {
      console.log(e.message);
      // TODO: aren't there instanceof checks we can do
      if (e.message.startsWith("Keys for idempotent requests")) {
        return;
      }
      if (
        e.message.startsWith(
          "Cannot create the usage record with this timestamp"
        )
      ) {
        return;
      }
      throw e;
    }
  }
}
