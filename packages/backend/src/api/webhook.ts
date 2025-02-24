import { useWorkspace, withActor } from "@console/core/actor";
import { stripeTable } from "@console/core/billing/billing.sql";
import { and, eq } from "@console/core/drizzle/index";
import { Billing } from "@console/core/billing/index";
import { stripe } from "@console/core/stripe/index";
import { useTransaction } from "@console/core/util/transaction";
import { Hono } from "hono";
import { Resource } from "sst";

export const WebhookRoute = new Hono();

WebhookRoute.post("/stripe", async (c) => {
  // validate signature
  const body = stripe.webhooks.constructEvent(
    await c.req.text(),
    c.req.header("stripe-signature")!,
    Resource.StripeWebhookSigningSecret.value,
  );

  console.log(body.type, body);
  if (body.type === "customer.subscription.created") {
    const { id: subscriptionID, customer, items } = body.data.object;
    const item = await Billing.Stripe.fromCustomerID(customer as string);
    if (!item) throw new Error("Workspace not found for customer");
    if (item.subscriptionID)
      throw new Error("Workspace already has a subscription");
    if (!items.data[0])
      throw new Error("Stripe webhook did not return a subscription item");
    const subscriptionItemID = items.data[0].id;
    const priceID = items.data[0].price.id;

    await withActor(
      {
        type: "system",
        properties: {
          workspaceID: item.workspaceID,
        },
      },
      async () => {
        await Billing.Stripe.setSubscription({
          subscriptionID,
          subscriptionItemID,
          priceID,
        });
        await Billing.updateGatingStatus();
      },
    );
  } else if (body.type === "customer.subscription.updated") {
    const { id: subscriptionID, customer, status } = body.data.object;

    const item = await Billing.Stripe.fromCustomerID(customer as string);
    if (!item) {
      throw new Error("Workspace not found for customer");
    }
    if (!item.subscriptionID) {
      throw new Error("Workspace does not have a subscription");
    }

    await withActor(
      {
        type: "system",
        properties: {
          workspaceID: item.workspaceID,
        },
      },
      async () => {
        if (status === "active" && item.standing === "overdue") {
          await Billing.Stripe.setStanding({
            subscriptionID,
            standing: "good",
          });
          await Billing.updateGatingStatus();
        } else if (status === "past_due" && item.standing !== "overdue") {
          await Billing.Stripe.setStanding({
            subscriptionID,
            standing: "overdue",
          });
          await Billing.updateGatingStatus();
        }
      },
    );
  } else if (body.type === "customer.subscription.deleted") {
    const { id: subscriptionID, customer } = body.data.object;
    await Billing.Stripe.removeSubscription(subscriptionID);

    const item = await Billing.Stripe.fromCustomerID(customer as string);
    if (!item) {
      throw new Error("Workspace not found for customer");
    }

    await withActor(
      {
        type: "system",
        properties: {
          workspaceID: item.workspaceID,
        },
      },
      async () => {
        await Billing.updateGatingStatus();
      },
    );
  } else if (
    body.type === "customer.discount.created" ||
    body.type === "customer.discount.updated"
  ) {
    const { customer } = body.data.object;

    const item = await Billing.Stripe.fromCustomerID(customer as string);
    if (!item) throw new Error("Workspace not found for customer");
    if (item.couponID) throw new Error("Workspace already has a coupon");

    await useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          couponID: body.data.object.coupon.id,
        })
        .where(
          and(
            eq(stripeTable.workspaceID, item.workspaceID),
            eq(stripeTable.customerID, customer as string),
          ),
        )
        .execute(),
    );
  } else if (body.type === "customer.discount.deleted") {
    const { customer } = body.data.object;

    const item = await Billing.Stripe.fromCustomerID(customer as string);
    if (!item) throw new Error("Workspace not found for customer");
    if (!item.couponID) throw new Error("Workspace does not have a coupon");

    await useTransaction((tx) =>
      tx
        .update(stripeTable)
        .set({
          couponID: null,
        })
        .where(
          and(
            eq(stripeTable.workspaceID, item.workspaceID),
            eq(stripeTable.customerID, customer as string),
          ),
        )
        .execute(),
    );
  }

  // Stripe has already retried charging the customer and failed. Stripe
  // will not retry again.
  else if (body.type === "invoice.marked_uncollectible") {
    const { id, created, customer, customer_email, amount_due } =
      body.data.object;
    console.error(
      `Invoice ${amount_due} for ${customer_email} is uncollectible`,
      {
        invoice: id,
        customer,
        created: new Date(created * 1000),
      },
    );
  }

  console.log("finished handling");

  return c.json("ok", 200);
});
