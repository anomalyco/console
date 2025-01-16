import { A, Navigate, Route, useNavigate } from "@solidjs/router";
import { Match, Show, Switch, createMemo } from "solid-js";
import { StateUpdateStore } from "$/data/app";
import { NavigationAction, useCommandBar } from "$/pages/workspace/command-bar";
import { useReplicache } from "$/providers/replicache";
import {
  StageContext,
  IssuesProvider,
  useStageContext,
  useIssuesContext,
  createStageContext,
  StateResourcesProvider,
  LogsProvider,
} from "./context";
import { Logs } from "./logs";
import { Issues } from "./issues";
import { Updates } from "./updates";
import { Resources } from "./resources";
import { IconSubRight } from "$/ui/icons/custom";
import {
  Header,
  PageHeader,
  HeaderProvider,
  useHeaderContext,
} from "../header";
import { NotFound } from "../../not-found";
import { TabTitle } from "$/ui/button";
import { Row, Fullscreen } from "$/ui/layout";
import { useApi, useWorkspace } from "../context";
import { GatedWarning } from "../app/warning";

export const StageRoute = (
  <Route
    component={(props) => {
      const api = useApi();
      const ctx = createStageContext();
      const rep = useReplicache();
      const header = useHeaderContext();
      const workspace = useWorkspace();
      return (
        <Show when={ctx.ready}>
          <Switch>
            <Match when={ctx.app && ctx.stage}>
              <StageContext.Provider value={ctx}>
                <StateResourcesProvider>
                  <LogsProvider>
                    <IssuesProvider>
                      <HeaderProvider>
                        {(() => {
                          const updates = StateUpdateStore.forStage.watch(
                            rep,
                            () => [ctx.stage.id]
                          );
                          const issues = useIssuesContext();
                          const issuesCount = createMemo(
                            () =>
                              issues().filter(
                                (item) =>
                                  !item.timeResolved && !item.timeIgnored
                              ).length
                          );
                          return (
                            <>
                              <Commands />
                              <Header
                                app={ctx.app.name}
                                stage={ctx.stage.name}
                              />
                              <Switch>
                                <Match when={ctx.stage.timeDeleted}>
                                  <NotFound
                                    inset="header"
                                    message="Stage has been removed"
                                  />
                                </Match>
                                <Match
                                  when={
                                    workspace().timeGated != null &&
                                    !ctx.connected &&
                                    !api.isFree
                                  }
                                >
                                  <Fullscreen inset="header-tabs">
                                    <GatedWarning />
                                  </Fullscreen>
                                </Match>
                                <Match when={true}>
                                  <PageHeader>
                                    <Row space="5" vertical="center">
                                      <A href="resources">
                                        <TabTitle size="sm">Resources</TabTitle>
                                      </A>
                                      <Show when={updates().length > 0}>
                                        <A href="updates">
                                          <TabTitle size="sm">Updates</TabTitle>
                                        </A>
                                      </Show>
                                      <Show when={!ctx.stage.timeDeleted}>
                                        <A href="issues">
                                          <TabTitle
                                            size="sm"
                                            count={
                                              issuesCount()
                                                ? issuesCount().toString()
                                                : undefined
                                            }
                                          >
                                            Issues
                                          </TabTitle>
                                        </A>
                                      </Show>
                                      <A href="logs">
                                        <TabTitle size="sm">Logs</TabTitle>
                                      </A>
                                      <Show when={ctx.connected && false}>
                                        <A href="local">
                                          <TabTitle size="sm">Local</TabTitle>
                                        </A>
                                      </Show>
                                    </Row>
                                    <Show when={header.children}>
                                      {header.children}
                                    </Show>
                                  </PageHeader>
                                  <div>{props.children}</div>
                                </Match>
                              </Switch>
                            </>
                          );
                        })()}
                      </HeaderProvider>
                    </IssuesProvider>
                  </LogsProvider>
                </StateResourcesProvider>
              </StageContext.Provider>
            </Match>
            <Match when={!ctx.stage}>
              <NotFound header inset="header" message="Stage not found" />
            </Match>
          </Switch>
        </Show>
      );
    }}
  >
    <Route path="resources" children={Resources} />
    <Route path="updates" children={Updates} />
    <Route path="issues" children={Issues} />
    <Route path="logs" children={Logs} />
    <Route path="" component={() => <Navigate href="resources" />} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);

export function Commands() {
  const bar = useCommandBar();
  const ctx = useStageContext();
  const nav = useNavigate();
  bar.register("stage", async () => {
    return [
      NavigationAction({
        icon: IconSubRight,
        path: "./issues",
        category: ctx.stage.name,
        title: "Issues",
        nav,
      }),
      NavigationAction({
        icon: IconSubRight,
        title: "Autodeploy",
        path: "./autodeploy",
        category: ctx.stage.name,
        nav,
      }),
      NavigationAction({
        icon: IconSubRight,
        title: "Resources",
        path: "./resources",
        category: ctx.stage.name,
        nav,
      }),
      NavigationAction({
        icon: IconSubRight,
        title: "Local",
        path: "./local",
        category: ctx.stage.name,
        disabled: !ctx.connected,
        nav,
      }),
      {
        icon: IconSubRight,
        title: "View logs...",
        run: (control) => {
          control.show("logs-switcher");
        },
        category: ctx.stage.name,
      },
      {
        icon: IconSubRight,
        title: "Switch stage...",
        run: (control) => {
          control.show("stage-switcher");
        },
        category: ctx.stage.name,
      },
    ];
  });

  return null;
}
