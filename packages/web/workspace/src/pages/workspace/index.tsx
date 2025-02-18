import {
  Route,
  useNavigate,
  useParams,
} from "@solidjs/router";
import {
  ReplicacheProvider,
  createSubscription,
  useReplicache,
} from "@console/web/providers/replicache";
import { NavigationAction, useCommandBar } from "./command-bar";
import { AppRoute } from "./app";
import { Match, Switch, createEffect, createMemo, onMount } from "solid-js";
import { IconWrenchScrewdriver } from "@console/web/ui/icons";
import { UserRoute } from "./user";
import { AccountRoute } from "./account";
import { SettingsRoute } from "./settings";
import { ApiProvider, WorkspaceContext } from "./context";
import { AppStore } from "@console/web/data/app";
import { IconApp, IconUserAdd, IconConnect } from "@console/web/ui/icons/custom";
import { StageStore } from "@console/web/data/stage";
import { useStorage } from "@console/web/providers/account";
import { NotFound, NotAllowed } from "../not-found";
import { DebugRoute } from "../debug";
import { useAuth } from "@console/web/providers/auth";
import { OverviewRoute } from "./overview-next";
import { ZeroProvider } from "./zero";

export const WorkspaceRoute = (
  <Route
    component={(props) => {
      const params = useParams();
      const auth = useAuth();
      const storage = useStorage();
      const nav = useNavigate();
      const workspace = createMemo(() =>
        auth.current.workspaces.find(
          (item) => item.slug === params.workspaceSlug,
        ),
      );
      const bar = useCommandBar();

      createEffect(() => {
        const w = workspace();
        if (!w) return;
        storage.set("workspace", w.id);
      });

      createEffect(() => {
        const workspaceSlug = params.workspaceSlug;
        for (const item of auth.all()) {
          for (const workspace of item.workspaces) {
            if (workspace.slug === workspaceSlug && item.id !== auth.current.id) {
              auth.switch(item.id);
            }
          }
        }
      })

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

      console.log("workspace page");
      return (
        <Switch>
          <Match when={!workspace()}>
            <NotAllowed header />
          </Match>
          <Match when={workspace()}>
            <ReplicacheProvider workspaceID={workspace()!.id}>
              <WorkspaceContext.Provider value={() => workspace()!}>
                {(() => {
                  const bar = useCommandBar();
                  const nav = useNavigate();
                  const params = useParams();
                  const apps = createSubscription(() => AppStore.all, []);
                  const stages = StageStore.list.watch(
                    useReplicache(),
                    () => [],
                  );

                  bar.register("stage-switcher", async (input, global) => {
                    if (!input && global) return [];
                    return stages()
                      .filter((stage) => !stage.timeDeleted)
                      .map((stage) => {
                        const app = apps.value.find(
                          (item) => item.id === stage.appID,
                        )!;
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

                  return null;
                })()}
                <ZeroProvider>
                  <ApiProvider>{props.children}</ApiProvider>
                </ZeroProvider>
              </WorkspaceContext.Provider>
            </ReplicacheProvider>
          </Match>
        </Switch>
      );
    }}
  >
    <Route path="user" component={UserRoute} />
    <Route path="account" component={AccountRoute} />
    <Route path="settings" component={SettingsRoute} />
    <Route path="debug" component={DebugRoute} />
    <Route path=":appName/*">{AppRoute}</Route>
    <Route path="" component={OverviewRoute} />
    <Route path="*" component={() => <NotFound header />} />
  </Route>
);
