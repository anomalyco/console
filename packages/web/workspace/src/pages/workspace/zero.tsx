import { Query, Schema, Zero } from "@rocicorp/zero"
import { useQuery } from "@rocicorp/zero/solid"
import { schema } from "@console/zero/schema"
import { useAuth } from "@console/web/providers/auth"
import { useWorkspace } from "./context"
import { createInitializedContext } from "@console/web/common/context"
import { createEffect } from "solid-js"

export const { use: useZero, provider: ZeroProvider } =
  createInitializedContext("ZeroContext", () => {
    const auth = useAuth()
    const workspace = useWorkspace()
    const zero = new Zero({
      schema: schema,
      auth: auth.current.access,
      userID: auth.current.email,
      storageKey: workspace().id,
      server: import.meta.env.VITE_ZERO_URL,
    })

    return {
      mutate: zero.mutate,
      query: zero.query,
      client: zero,
      ready: true,
    };
  });

export function usePersistentQuery<TSchema extends Schema, TTable extends keyof TSchema['tables'] & string, TReturn>(querySignal: () => Query<TSchema, TTable, TReturn>) {
  const workspace = useWorkspace()
  // @ts-ignore
  const q = () => querySignal().where("workspace_id", "=", workspace().id).where("time_deleted", "IS", null)
  createEffect(() => {
    q().preload()
  })
  return useQuery<TSchema, TTable, TReturn>(q)
}
