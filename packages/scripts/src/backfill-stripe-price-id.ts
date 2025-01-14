import { and, db, isNotNull, isNull } from "@console/core/drizzle";
import { stripeTable } from "@console/core/billing/billing.sql";
import { Resource } from "sst";

await db
  .update(stripeTable)
  .set({
    priceID: Resource.StripeInvocationsPriceID.value,
  })
  .where(
    and(isNotNull(stripeTable.subscriptionID), isNull(stripeTable.priceID))
  );
