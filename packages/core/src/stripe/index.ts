import { Resource } from "sst";
import { Stripe } from "stripe";

// TODO: add stripe secret
export const stripe = new Stripe("", {
  apiVersion: "2024-06-20",
});
