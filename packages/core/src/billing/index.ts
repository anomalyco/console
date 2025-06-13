import { createSelectSchema } from "drizzle-zod";
import { Resource } from "sst";
import { usage } from "./billing.sql";
import { z } from "zod";
import { zod } from "../util/zod";
import {
  eq,
  and,
  between,
  sql,
  lt,
  or,
  isNotNull,
  isNull,
  gte,
  inArray,
} from "drizzle-orm";
import { useTransaction } from "../util/transaction";
import { useWorkspace } from "../actor";
import { workspace } from "../workspace/workspace.sql";
import { Stripe } from "./stripe";
import { DateTime } from "luxon";
import { Warning } from "../warning";
import { stateCountTable, stateUpdateTable } from "../state/state.sql";
import { stage } from "../app/app.sql";
export * as Billing from "./index";
export { Stripe } from "./stripe";

export const Usage = createSelectSchema(usage, {
  id: (schema) => schema.id.cuid2(),
  workspaceID: (schema) => schema.workspaceID.cuid2(),
  stageID: (schema) => schema.stageID.cuid2(),
});
export type Usage = z.infer<typeof Usage>;

const FREE_RESOURCES = 350;

export const countInvocationsByStartAndEndDay = zod(
  z.object({
    startDay: Usage.shape.day,
    endDay: Usage.shape.day,
  }),
  async (input) => {
    const rows = await useTransaction((tx) =>
      tx
        .select()
        .from(usage)
        .where(
          and(
            eq(usage.workspaceID, useWorkspace()),
            between(usage.day, input.startDay, input.endDay),
          ),
        )
        .execute(),
    );
    return rows.reduce((acc, usage) => acc + usage.invocations, 0);
  },
);

export const countActiveResources = zod(z.void(), async () => {
  const currentMonthStart = DateTime.utc().startOf("month").toSQLDate()!;

  return await useTransaction(async (tx) => {
    // Get all stages with a deploy command in the current month
    const activeStageIds = await tx
      .select({
        stageID: stateUpdateTable.stageID,
      })
      .from(stateUpdateTable)
      .innerJoin(
        stage,
        and(
          eq(stage.id, stateUpdateTable.stageID),
          eq(stage.workspaceID, stateUpdateTable.workspaceID),
        ),
      )
      .where(
        and(
          eq(stateUpdateTable.workspaceID, useWorkspace()),
          eq(stateUpdateTable.command, "deploy"),
          gte(stateUpdateTable.timeStarted, sql`${currentMonthStart}`),
          or(
            and(
              isNull(stage.timeDeleted),
              lt(stage.timeCreated, sql`NOW() - INTERVAL 14 DAY`),
            ),
            and(
              isNotNull(stage.timeDeleted),
              lt(
                stage.timeCreated,
                sql`${stage.timeDeleted} - INTERVAL 14 DAY`,
              ),
            ),
          ),
        ),
      )
      .groupBy(stateUpdateTable.stageID)
      .execute()
      .then((rows) => rows.map((row) => row.stageID));

    if (activeStageIds.length === 0) return 0;

    // Get the resource count only for stages with deploys in the current month
    return tx
      .select({
        total: sql<number>`SUM(${stateCountTable.count})`,
      })
      .from(stateCountTable)
      .where(
        and(
          eq(stateCountTable.workspaceID, useWorkspace()),
          eq(stateCountTable.month, currentMonthStart),
          inArray(stateCountTable.stageID, activeStageIds),
        ),
      )
      .execute()
      .then((x) => x[0]?.total ?? 0);
  });
});

export const updateGatingStatus = zod(z.void(), async () => {
  async function isGated() {
    // check subscription status
    const customer = await Stripe.get();
    const subscriptionStatus = customer?.standing;
    if (subscriptionStatus === "overdue") return true;

    console.log({
      ended: customer?.timeTrialEnded,
      now: DateTime.now().toSQL(),
    });
    if (
      customer?.timeTrialEnded &&
      customer.timeTrialEnded > DateTime.now().toSQL()!
    ) {
      console.log("Trial STILL ON!!!");
      return false;
    }

    // note: only check for permission_usage warnings if the price is for invocations
    if (customer?.priceID === Resource.StripeInvocationsPriceID.value) {
      const warnings = await Warning.forType({
        type: "permission_usage",
        stageID: null,
      });
      if (warnings.length) return true;
      return false;
    }

    if (customer?.priceID === Resource.StripeResourcesPriceID.value)
      return false;

    const resources = await countActiveResources();
    return resources > FREE_RESOURCES;
  }

  const timeGated = (await isGated()) ? sql`NOW()` : null;

  return useTransaction((tx) =>
    tx
      .update(workspace)
      .set({ timeGated })
      .where(eq(workspace.id, useWorkspace()))
      .execute(),
  );
});
