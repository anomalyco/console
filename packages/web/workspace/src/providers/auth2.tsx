import { makePersisted } from "@solid-primitives/storage";
import { createInitializedContext } from "$/common/context";
import { createStore, produce, reconcile, unwrap } from "solid-js/store";
import { createEffect, createMemo } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { IconUserMinus, IconUserPlus, IconUsers } from "../ui/icons";
import { useCommandBar, Action } from "$/pages/workspace/command-bar";
import type { Workspace } from "@console/core/workspace";
import { useStorage } from "./account";
import { IconLogout } from "$/ui/icons/custom";

interface AccountInfo {
  id: string;
  token: string;
  email: string;
  workspaces: Workspace.Info[];
}

interface Storage {
  accounts: Record<string, AccountInfo>;
  current?: string;
}

export const { use: useAuth2, provider: AuthProvider2 } =
  createInitializedContext("AuthContext", () => {
    const bar = useCommandBar();
    const nav = useNavigate();
    const [store, setStore] = makePersisted(
      createStore<Storage>({
        accounts: {},
      }),
      {
        name: "sst.auth",
      },
    );
    const location = useLocation();
    const accessToken = createMemo(() =>
      new URLSearchParams(location.hash.substring(1)).get("access_token"),
    );

    createEffect(() => {
      if (accessToken()) return;
      if (Object.keys(store.accounts).length) return;
      console.log("no accounts, redirecting to auth");
      nav("/auth");
    });

    createEffect(() => {
      if (store.current && !store.accounts[store.current]) {
        setStore("current", Object.keys(store.accounts)[0]);
        nav("/");
      }
    });

    async function refresh() {
      const all = [];
      for (const token of [...Object.keys(store.accounts), accessToken()]) {
        if (!token) continue;
        const prom = fetch(import.meta.env.VITE_API_URL + "/account", {
          headers: {
            authorization: `Bearer ${token}`,
          },
        }).then(async (response) => {
          if (response.ok) {
            const info = await response.json();
            if (
              !accessToken() ||
              !Object.values(store.accounts).find((a) => a.id === info.id)
            )
              setStore(
                "accounts",
                token,
                reconcile({
                  ...info,
                  token,
                }),
              );
          }

          if (!response.ok)
            setStore(
              produce((state) => {
                delete state.accounts[token];
              }),
            );

          if (accessToken() === token) {
            setStore("current", token);
            window.location.hash = "";
          }
        });
        all.push(prom);
      }
      await Promise.all(all);
    }

    refresh();

    const navigate = useNavigate();
    bar.register("auth", async () => {
      return [
        ...Object.entries(store.accounts).map(
          ([key, account]): Action => ({
            title: "Switch to " + account.email,
            disabled: key === store.current,
            category: "Account",
            icon: IconUsers,
            run(control) {
              setStore("current", key);
              navigate("/");
              control.hide();
            },
          }),
        ),
        {
          title: "Add account",
          category: "Account",
          icon: IconUserPlus,
          run() {
            navigate("/auth");
          },
        },
        {
          title: "Log out of " + store.accounts[store.current!]?.email,
          category: "Account",
          icon: IconLogout,
          run(control) {
            result.logout();
            navigate("/");
            control.hide();
          },
        },
      ];
    });

    const result = {
      get current() {
        const result = store.accounts[store.current!]!;
        return result;
      },
      switch(accountID: string) {
        setStore("current", accountID);
      },
      get all() {
        return Object.values(store.accounts);
      },
      refresh,
      logout() {
        setStore(
          produce((state) => {
            if (!state.current) return;
            delete state.accounts[state.current];
            state.current = Object.keys(state.accounts)[0];
          }),
        );
      },
      get ready() {
        return Boolean(!accessToken() && store.current);
      },
    };
    return result;
  });
