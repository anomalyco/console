import type { LambdaPayload } from "@console/core/lambda/index";
import { Store } from "./store";

export const LambdaPayloadStore = new Store()
  .type<LambdaPayload>()
  .scan("list", () => ["lambdaPayload"])
  .get((id: string) => [`lambdaPayload`, id])
  .build();
