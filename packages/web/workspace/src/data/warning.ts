import type { Info } from "@console/core/warning/index";
import { Store } from "./store";

export const WarningStore = new Store()
  .type<Info>()
  .scan("list", () => ["warning"])
  .scan("forStage", (stageID: string) => ["warning", stageID])
  .scan("forType", (stageID: string, type: Info["type"]) => [
    "warning",
    stageID,
    type,
  ])
  .get((stageID: string, type: string, id: string) => [
    "warning",
    stageID,
    type,
    id,
  ])
  .build();
