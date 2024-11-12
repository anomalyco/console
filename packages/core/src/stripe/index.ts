import { Resource } from "sst";
import { Stripe } from "stripe";

export const stripe = new Stripe(Resource.StripeSecretKey.value, {
  apiVersion: "2024-06-20",
});
