import { Workspace } from "@console/core/workspace";
import { db, eq, isNull } from "@console/core/drizzle";
import { workspace } from "@console/core/workspace/workspace.sql";
import { stripeTable } from "@console/core/billing/billing.sql";
import { Billing } from "@console/core/billing";
import { withActor } from "@console/core/actor";

const workspaces = await db
  .select({
    id: workspace.id,
  })
  .from(workspace)
  .leftJoin(stripeTable, eq(workspace.id, stripeTable.workspaceID))
  .where(isNull(stripeTable.customerID))
  .execute();

console.log("found", workspaces.length, "workspaces");

for (const workspace of workspaces) {
  await withActor(
    {
      type: "system",
      properties: {
        workspaceID: workspace.id,
      },
    },
    async () => {
      await Billing.Stripe.createCustomer();
    },
  );
}
