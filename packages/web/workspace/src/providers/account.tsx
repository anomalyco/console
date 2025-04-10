import { makePersisted } from "@solid-primitives/storage";
import { ParentProps, createContext, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { reconcile } from "solid-js/store";

type Context = ReturnType<typeof init>;
const context = createContext<Context>();

function init() {
  const [store, setStore] = makePersisted(
    createStore({
      account: "",
      workspace: "",
      dummy: "",
    })
  );

  return {
    value: store,
    set: setStore,
  };
}

export function StorageProvider(props: ParentProps) {
  const ctx = init();
  return <context.Provider value={ctx}>{props.children}</context.Provider>;
}

export function useStorage() {
  const ctx = useContext(context);
  if (!ctx) {
    throw new Error("No storage context");
  }
  return ctx;
}

import { createEffect } from "solid-js";
import { useOpenAuth } from "@openauthjs/solid"
import { createInitializedContext } from "../common/context";
import { Workspace } from "@console/core/workspace/index";

type Storage = {
  accounts: Record<string, {
    id: string
    email: string
    workspaces: Workspace.Info[];
  }>
}

export const { use: useAccount, provider: AccountProvider } = createInitializedContext("AccountContext", () => {
  const auth = useOpenAuth()
  const [store, setStore] = makePersisted(
    createStore<Storage>({
      accounts: {},
    }),
    {
      name: "sst.account",
    },
  );

  async function refresh(id: string) {
    const access = await auth.access(id).catch(() => { })
    if (!access) {
      auth.authorize({
        provider: "email",
      })
      return
    }
    return await fetch(import.meta.env.VITE_API_URL + "/account", {
      headers: {
        authorization: `Bearer ${access}`,
      },
    })
      .then(val => val.json())
      .then(val => {
        if (val.id)
          setStore("accounts", id, reconcile(val))
      })
  }

  createEffect((previous: string[]) => {
    if (!Object.values(auth.all).length) {
      auth.authorize({
        provider: "email",
      })
      return []
    }
    for (const item of Object.values(auth.all)) {
      if (previous.includes(item.id)) continue
      refresh(item.id)
    }
    return Object.keys(auth.all)
  }, [] as string[])

  return {
    get all() {
      return Object.keys(auth.all).map(id => store.accounts[id])
    },
    get current() {
      return store.accounts[auth.subject!.id]
    },
    refresh,
    get ready() {
      if (!auth.subject) return false
      return store.accounts[auth.subject.id]?.email != undefined
    }
  }
})

