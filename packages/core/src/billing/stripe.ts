import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { stripeTable } from "./billing.sql";
import { zod } from "../util/zod";
import { useTransaction } from "../util/transaction";
import { eq, and } from "drizzle-orm";
import { useWorkspace } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { stripe } from "../stripe";

export * as Stripe from "./stripe";

export const Info = createSelectSchema(stripeTable, {
  customerID: (schema) => schema.customerID.trim().nonempty(),
  subscriptionID: (schema) => schema.subscriptionID.trim().nonempty(),
  subscriptionItemID: (schema) => schema.subscriptionItemID.trim().nonempty(),
});
export type Info = z.infer<typeof Info>;

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

export const setSubscription = zod(
  Info.pick({
    subscriptionID: true,
    subscriptionItemID: true,
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          subscriptionID: input.subscriptionID,
          subscriptionItemID: input.subscriptionItemID,
        })
        .where(eq(stripeTable.workspaceID, useWorkspace()))
        .execute(),
    ),
);

export const setCustomerID = zod(Info.shape.customerID, (input) =>
  useTransaction((tx) =>
    tx
      .insert(stripeTable)
      .values({
        workspaceID: useWorkspace(),
        id: createId(),
        customerID: input,
        standing: "good",
      })
      .onDuplicateKeyUpdate({
        set: {
          customerID: input,
          standing: "good",
        },
      })
      .execute(),
  ),
);

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

  await setCustomerID(customer.id);
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

export const setStanding = zod(
  Info.pick({
    subscriptionID: true,
    standing: true,
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

export const removeSubscription = zod(
  z.string().min(1),
  (stripeSubscriptionID) =>
    useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          subscriptionItemID: null,
          subscriptionID: null,
        })
        .where(and(eq(stripeTable.subscriptionID, stripeSubscriptionID)))
        .execute(),
    ),
);
