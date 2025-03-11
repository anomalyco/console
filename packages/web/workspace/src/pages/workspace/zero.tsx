import { Query, Schema, Zero } from "@rocicorp/zero"
import { useQuery } from "@rocicorp/zero/solid"
import { schema } from "@console/zero/schema"
import { useWorkspace } from "./context"
import { createInitializedContext } from "@console/web/common/context"
import { createEffect } from "solid-js"
import { useOpenAuth } from "@openauthjs/solid"
import { useAccount } from "@console/web/providers/account"

export const { use: useZero, provider: ZeroProvider } =
  createInitializedContext("ZeroContext", () => {
    const auth = useOpenAuth()
    const account = useAccount()
    const workspace = useWorkspace()
    const zero = new Zero({
      schema: schema,
      auth: () => auth.access(),
      userID: account.current.email,
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
