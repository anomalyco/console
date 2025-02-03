import { createInitializedContext } from "@console/web/common/context";
import { useAuth } from "@console/web/providers/auth";
import { Workspace } from "@console/core/workspace/index";
import { type app } from "@console/functions/api/api";
import { useReplicache } from "@console/web/providers/replicache";
import {
  INVOCATIONS_PRICING_PLAN,
  RESOURCES_PRICING_PLAN,
  ResourcesUsageStore,
} from "@console/web/data/usage";
import { StripeStore } from "@console/web/data/app";
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
    const auth = useAuth();
    const workspace = useWorkspace();
    const usage = ResourcesUsageStore.list.watch(
      rep,
      () => [],
      (items) => sumBy(items, (item) => item.count),
    );
    const stripe = StripeStore.get.watch(rep, () => []);
    const client = hc<typeof app>(import.meta.env.VITE_API_URL, {
      headers: {
        Authorization: `Bearer ${auth.current.access}`,
        "x-sst-workspace": workspace().id,
      },
    });
    return {
      client,
      ready: true,
      get isFree() {
        return stripe()?.price === "invocations"
          ? usage() <= INVOCATIONS_PRICING_PLAN[0].to
          : usage() <= RESOURCES_PRICING_PLAN[0].to;
      },
    };
  },
);
