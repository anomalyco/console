import { createInitializedContext } from "@console/web/common/context";
import { Workspace } from "@console/core/workspace/index";
import { type app } from "@console/backend/api/index";
import { useReplicache } from "@console/web/providers/replicache";
import {
  RESOURCES_PRICING_PLAN,
  ResourcesUsageStore,
} from "@console/web/data/usage";
import { hc } from "hono/client";
import { Accessor, createContext, useContext } from "solid-js";
import { sumBy } from "remeda";
import { useOpenAuth } from "@openauthjs/solid";

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
    const auth = useOpenAuth();
    const workspace = useWorkspace();
    const usage = ResourcesUsageStore.list.watch(
      rep,
      () => [],
      (items) => sumBy(items, (item) => item.count),
    );
    const client = hc<typeof app>(import.meta.env.VITE_API_URL, {
      async fetch(...args: Parameters<typeof fetch>): Promise<Response> {
        const [input, init] = args;
        const request =
          input instanceof Request ? input : new Request(input, init);
        const headers = new Headers(request.headers);
        headers.set("authorization", `Bearer ${await auth.access()}`);
        headers.set("x-sst-workspace", workspace().id);

        return fetch(
          new Request(request, {
            ...init,
            headers,
          }),
        );
      },
    });
    return {
      client,
      ready: true,
      get isGated() {
        return (
          workspace().timeGated !== null &&
          usage() > RESOURCES_PRICING_PLAN[0].to
        );
      },
    };
  },
);
