import { Hono } from "hono";
import { notPublic } from "./auth";
import { Billing } from "@console/core/billing";
import { stripe } from "@console/core/stripe";
import { DateTime } from "luxon";

export const BillingRoute = new Hono().use(notPublic);

BillingRoute.post("/checkout", async (c) => {
  const body = await c.req.json();

  const item = await Billing.Stripe.get();
  if (!item?.customerID) {
    throw new Error("No stripe customer ID");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        // TODO: add stripe price id
        price: "",
      },
    ],
    customer: item.customerID,
    success_url: body.return_url,
    cancel_url: body.return_url,
    subscription_data: {
      proration_behavior: "none",
      billing_cycle_anchor: getAnchorDate().toUnixInteger(),
    },
  });

  return c.json({
    url: session.cancel_url,
  });
});

BillingRoute.post("/portal", async (c) => {
  const body = await c.req.json();

  const item = await Billing.Stripe.get();
  if (!item?.customerID) {
    throw new Error("No stripe customer ID");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: item.customerID,
    return_url: body.return_url,
  });

  return c.json({
    url: session.url,
  });
});

function getAnchorDate() {
  const now = DateTime.now();

  // check if falls in current month's anchor date
  // ie. Current time: Nov 1, 5am UTC
  //     Anchor date: Nov 1, 12pm UTC
  const anchor = now.toUTC().startOf("month").plus({ hour: 12 });
  if (anchor.toUnixInteger() > now.toUnixInteger()) return anchor;

  // ie. Current time: Nov 2, 5am UTC
  //     Anchor date: Dec 1, 12pm UTC
  return now.toUTC().plus({ month: 1 }).startOf("month").plus({ hour: 12 });
}
