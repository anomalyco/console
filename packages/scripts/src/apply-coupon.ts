import { Resource } from "sst";
import { stripe } from "@console/core/stripe/index";
import { useTransaction } from "@console/core/util/transaction";
import { eq } from "@console/core/drizzle/index";
import { workspace } from "@console/core/workspace/workspace.sql";
import { stripeTable } from "@console/core/billing/billing.sql";
import { DateTime } from "luxon";

const args = process.argv.slice(2);
if (args.length !== 1 || !args[0]) {
  console.error("Usage: apply-coupon.ts <workspace>");
  process.exit(1);
}
const workspaceSlug = args[0];
const result = await useTransaction((tx) =>
  tx
    .select({
      workspaceID: workspace.id,
      slug: workspace.slug,
      stripeCustomerID: stripeTable.customerID,
    })
    .from(workspace)
    .innerJoin(stripeTable, eq(workspace.id, stripeTable.workspaceID))
    .where(eq(workspace.slug, workspaceSlug))
    .execute()
    .then((rows) => rows[0]),
);
if (!result || !result.stripeCustomerID) {
  console.error("Workspace not found");
  process.exit(1);
}

const response = await stripe.customers.update(result.stripeCustomerID, {
  coupon: Resource.StripeCouponID.value,
});

console.log("");
console.log(`Coupon applied!`);
console.log(`Workspace: ${result.slug} (id: ${result.workspaceID})`);
console.log(
  `Expiry:    ${DateTime.fromSeconds(
    response.discount?.end ?? 0,
  ).toLocaleString(DateTime.DATE_FULL)}`,
);
console.log("");
