import { Route, Routes, useNavigate, useParams } from "@solidjs/router";
import {
  ReplicacheProvider,
  createSubscription,
  useReplicache,
} from "$/providers/replicache";
import { NavigationAction, useCommandBar } from "./command-bar";
import { App } from "./app";
import { Match, Switch, createEffect, createMemo } from "solid-js";
import { IconWrenchScrewdriver } from "$/ui/icons";
import { User } from "./user";
import { Account } from "./account";
import { Settings } from "./settings";
import { Overview } from "./overview";
import { ApiProvider, WorkspaceContext } from "./context";
import { AppStore } from "$/data/app";
import { IconApp, IconUserAdd, IconConnect } from "$/ui/icons/custom";
import { StageStore } from "$/data/stage";
import { useStorage } from "$/providers/account";
import { NotFound, NotAllowed } from "../not-found";
import { Debug } from "../debug";
import { useAuth2 } from "$/providers/auth2";
import { useFlags } from "$/providers/flags";
import { OverviewNext } from "./overview-next";

export function Workspace() {
  const params = useParams();
  const auth = useAuth2();
  const storage = useStorage();
  const nav = useNavigate();
  const workspace = createMemo(() =>
    auth.current.workspaces.find((item) => item.slug === params.workspaceSlug),
  );
  const bar = useCommandBar();

  createEffect(() => {
    const w = workspace();
    if (!w) return;
    storage.set("workspace", w.id);
  });

  bar.register("workspace", async () => {
    return [
      NavigationAction({
        title: "Overview",
        category: "Workspace",
        path: `/${workspace()?.slug}`,
        nav,
      }),
      NavigationAction({
        icon: IconUserAdd,
        title: "Invite user to workspace",
        category: "Workspace",
        path: `/${workspace()?.slug}/user`,
        nav,
      }),
      NavigationAction({
        icon: IconConnect,
        title: "Connect an AWS Account",
        category: "Workspace",
        path: `/${workspace()?.slug}/account`,
        nav,
      }),
      NavigationAction({
        icon: IconWrenchScrewdriver,
        title: "Manage workspace settings",
        category: "Workspace",
        path: `/${workspace()?.slug}/settings`,
        nav,
      }),
    ];
  });

  return (
    <Switch>
      <Match when={!workspace()}>
        <NotAllowed header />
      </Match>
      <Match when={workspace()}>
        <ReplicacheProvider workspaceID={workspace()!.id}>
          <WorkspaceContext.Provider value={() => workspace()!}>
            <ApiProvider>
              <Content />
            </ApiProvider>
          </WorkspaceContext.Provider>
        </ReplicacheProvider>
      </Match>
    </Switch>
  );
}

export function Content() {
  const bar = useCommandBar();
  const nav = useNavigate();
  const params = useParams();
  const apps = createSubscription(AppStore.all, []);
  const stages = StageStore.list.watch(useReplicache(), () => []);

  bar.register("stage-switcher", async (input, global) => {
    if (!input && global) return [];
    return stages()
      .filter((stage) => !stage.timeDeleted)
      .map((stage) => {
        const app = apps.value.find((item) => item.id === stage.appID)!;
        return NavigationAction({
          icon: IconApp,
          category: "Stage",
          title: `Go to "${app.name} / ${stage.name}"`,
          path: `/${params.workspaceSlug}/${app.name}/${stage.name}`,
          prefix: true,
          nav,
        });
      });
  });

  bar.register("app-switcher", async (input, global) => {
    if (!input && global) return [];
    return apps.value.map((app) =>
      NavigationAction({
        icon: IconApp,
        category: "App",
        title: `Go to "${app.name}"`,
        path: `/${params.workspaceSlug}/${app.name}`,
        prefix: true,
        nav,
      }),
    );
  });

  return (
    <Routes>
      <Route path="user" component={User} />
      <Route path="account" component={Account} />
      <Route path="settings" component={Settings} />
      <Route path="debug" component={Debug} />
      <Route path=":appName/*" component={App} />
      <Route path="" component={OverviewNext} />
      <Route path="*" element={<NotFound header />} />
    </Routes>
  );
}
