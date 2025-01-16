import { createInitializedContext } from "$/common/context";
import { useAuth2 } from "$/providers/auth2";
import { Workspace } from "@console/core/workspace";
import { app } from "@console/functions/api/api";
import { useReplicache } from "$/providers/replicache";
import { RESOURCES_PRICING_PLAN, ResourcesUsageStore } from "$/data/usage";
import { hc } from "hono/client";
import { Accessor, createContext, useContext } from "solid-js";
import { sumBy } from "remeda";

export const WorkspaceContext = createContext<Accessor<Workspace.Info>>();

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("No workspace context");
  return context;
}

export const { use: useApi, provider: ApiProvider } = createInitializedContext(
  "Api",
  () => {
    const rep = useReplicache();
    const auth = useAuth2();
    const workspace = useWorkspace();
    const usage = ResourcesUsageStore.list.watch(
      rep,
      () => [],
      (items) => sumBy(items, (item) => item.count)
    );
    const client = hc<typeof app>(import.meta.env.VITE_API_URL, {
      headers: {
        Authorization: `Bearer ${auth.current.token}`,
        "x-sst-workspace": workspace().id,
      },
    });
    return {
      client,
      ready: true,
      get isFree() {
        return usage() <= RESOURCES_PRICING_PLAN[0].to;
      },
    };
  }
);
