import type { Info } from "@console/core/workspace/index";
import { Store } from "./store";

export const WorkspaceStore = new Store()
  .type<Info>()
  .scan("list", () => ["workspace"])
  .get((id: string) => [`workspace`, id])
  .build();
