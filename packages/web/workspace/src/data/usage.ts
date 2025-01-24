import type { Usage } from "@console/core/billing/index";
import type { State } from "@console/core/state/index";
import { Store } from "./store";

type PricingTier = {
  from: number;
  to: number;
  rate: number;
};

export type PricingPlan = PricingTier[];

export const INVOCATIONS_PRICING_PLAN: PricingPlan = [
  { from: 0, to: 1000000, rate: 0 },
  { from: 1000000, to: 10000000, rate: 0.00002 },
  { from: 10000000, to: Infinity, rate: 0.000002 },
];

export const RESOURCES_PRICING_PLAN: PricingPlan = [
  { from: 0, to: 200, rate: 0 },
  { from: 0, to: 2000, rate: 0.086 },
  { from: 2000, to: Infinity, rate: 0.032 },
];

export const InvocationsUsageStore = new Store()
  .type<Usage>()
  .scan("list", () => [`usage`])
  .scan("forStage", (stageID: string) => [`usage`, stageID])
  .build();

export const ResourcesUsageStore = new Store()
  .type<State.Count>()
  .scan("list", () => [`stateCount`])
  .build();
