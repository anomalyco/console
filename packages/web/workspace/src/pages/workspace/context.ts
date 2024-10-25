import { createInitializedContext } from "$/common/context";
import { useAuth2 } from "$/providers/auth2";
import { Workspace } from "@console/core/workspace";
import { hc } from "hono/client";
import { Accessor, createContext, useContext } from "solid-js";

export const WorkspaceContext = createContext<Accessor<Workspace.Info>>();

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("No workspace context");
  return context;
}

export const { use: useApi, provider: ApiProvider } = createInitializedContext(
  "Api",
  () => {
    const auth = useAuth2();
    const workspace = useWorkspace();
    const client = hc(import.meta.env.VITE_API_URL, {
      headers: {
        Authorization: `Bearer ${auth.current.token}`,
        "x-sst-workspace": workspace().id,
      },
    });
    return {
      client,
      ready: true,
    };
  },
);
