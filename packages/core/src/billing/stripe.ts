import { z } from "zod";
import { Resource } from "sst";
import { Standing, stripeTable } from "./billing.sql";
import { zod } from "../util/zod";
import { useTransaction } from "../util/transaction";
import { eq, and } from "drizzle-orm";
import { useWorkspace } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { stripe } from "../stripe";

export * as Stripe from "./stripe";

export const Info = z.object({
  id: z.string().cuid2(),
  customerID: z.string().optional(),
  subscriptionID: z.string().optional(),
  subscriptionItemID: z.string().optional(),
  price: z.enum(["invocations", "resources"]).optional(),
  discount: z.number().optional(),
  standing: z.enum(Standing),
  time: z.object({
    created: z.string(),
    deleted: z.string().optional(),
    updated: z.string(),
    trialEnded: z.string().optional(),
  }),
});
export type Info = z.infer<typeof Info>;

export function serialize(input: typeof stripeTable.$inferSelect): Info {
  return {
    id: input.id,
    customerID: input.customerID ?? undefined,
    subscriptionID: input.subscriptionID ?? undefined,
    subscriptionItemID: input.subscriptionItemID ?? undefined,
    price:
      input.priceID === Resource.StripeInvocationsPriceID.value
        ? ("invocations" as const)
        : input.priceID === Resource.StripeResourcesPriceID.value
        ? ("resources" as const)
        : undefined,
    discount: input.couponID === Resource.StripeCouponID.value ? 50 : undefined,
    standing: input.standing ?? "good",
    time: {
      created: input.timeCreated,
      updated: input.timeUpdated,
      deleted: input.timeDeleted ?? undefined,
      trialEnded: input.timeTrialEnded ?? undefined,
    },
  };
}

export function get() {
  return useTransaction((tx) =>
    tx
      .select()
      .from(stripeTable)
      .where(eq(stripeTable.workspaceID, useWorkspace()))
      .execute()
      .then((rows) => rows.at(0)),
  );
}

export async function createCustomer() {
  const workspaceID = useWorkspace();
  const subscription = await get();
  if (subscription?.customerID) {
    console.log("Already has stripe customer ID");
    return;
  }
  const customer = await stripe.customers.create({
    //email: evt.properties.email,
    metadata: {
      workspaceID,
    },
  });

  const customerID = customer.id;
  await useTransaction((tx) =>
    tx
      .insert(stripeTable)
      .values({
        workspaceID: useWorkspace(),
        id: createId(),
        customerID,
        standing: "good",
      })
      .onDuplicateKeyUpdate({
        set: {
          customerID,
          standing: "good",
        },
      })
      .execute(),
  );
}

export const fromCustomerID = zod(z.string(), (input) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(stripeTable)
      .where(and(eq(stripeTable.customerID, input)))
      .execute()
      .then((rows) => rows.at(0)),
  ),
);

export const setSubscription = zod(
  z.object({
    subscriptionID: z.string().min(1),
    subscriptionItemID: z.string().min(1),
    priceID: z.string().min(1),
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          subscriptionID: input.subscriptionID,
          subscriptionItemID: input.subscriptionItemID,
          priceID: input.priceID,
        })
        .where(eq(stripeTable.workspaceID, useWorkspace()))
        .execute(),
    ),
);

export const removeSubscription = zod(
  z.string().min(1),
  (stripeSubscriptionID) =>
    useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          subscriptionItemID: null,
          subscriptionID: null,
          priceID: null,
        })
        .where(and(eq(stripeTable.subscriptionID, stripeSubscriptionID)))
        .execute(),
    ),
);

export const setStanding = zod(
  z.object({
    subscriptionID: z.string().min(1),
    standing: z.enum(Standing),
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          standing: input.standing,
        })
        .where(and(eq(stripeTable.subscriptionID, input.subscriptionID!)))
        .execute(),
    ),
);

export const grantTrial = zod(z.string().nonempty(), (timeTrialEnded) =>
  useTransaction((tx) =>
    tx
      .update(stripeTable)
      .set({
        timeTrialEnded: timeTrialEnded,
      })
      .where(eq(stripeTable.workspaceID, useWorkspace()))
      .execute(),
  ),
);
