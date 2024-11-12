import { createSelectSchema } from "drizzle-zod";
import { usage } from "./billing.sql";
import { z } from "zod";
import { zod } from "../util/zod";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, between, sql } from "drizzle-orm";
import { useTransaction } from "../util/transaction";
import { useWorkspace } from "../actor";
import { workspace } from "../workspace/workspace.sql";
import { Stripe } from "./stripe";
import { DateTime } from "luxon";
import { Warning } from "../warning";
export * as Billing from "./index";
export { Stripe } from "./stripe";

export const Usage = createSelectSchema(usage, {
  id: (schema) => schema.id.cuid2(),
  workspaceID: (schema) => schema.workspaceID.cuid2(),
  stageID: (schema) => schema.stageID.cuid2(),
});
export type Usage = z.infer<typeof Usage>;

const FREE_INVOCATIONS = 1000000;

export const createUsage = zod(
  Usage.pick({ stageID: true, day: true, invocations: true }),
  (input) =>
    useTransaction((tx) =>
      tx
        .insert(usage)
        .values({
          id: createId(),
          workspaceID: useWorkspace(),
          stageID: input.stageID,
          day: input.day,
          invocations: input.invocations,
        })
        .onDuplicateKeyUpdate({
          set: {
            invocations: input.invocations,
          },
        })
        .execute(),
    ),
);

export const countByStartAndEndDay = zod(
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

    const warnings = await Warning.forType({
      type: "permission_usage",
      stageID: null,
    });
    if (warnings.length) return true;

    // check usage
    if (!customer?.subscriptionID) {
      const startDate = DateTime.now().toUTC().startOf("day");
      const invocations = await countByStartAndEndDay({
        startDay: startDate.startOf("month").toSQLDate()!,
        endDay: startDate.endOf("month").toSQLDate()!,
      });
      if (invocations > FREE_INVOCATIONS) return true;
    }
    return false;
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
