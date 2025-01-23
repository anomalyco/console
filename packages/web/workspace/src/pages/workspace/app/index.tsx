import { Show } from "solid-js";
import { AppContext, createAppContext, useAppContext } from "./context";
import { HeaderProvider } from "../header";
import { Route, useNavigate } from "@solidjs/router";
import { NotFound } from "@console/web/pages/not-found";
import { StageRoute } from "../stage";
import { Settings } from "./settings";
import { Autodeploy } from "./autodeploy";
import { Overview } from "./overview";
import { NavigationAction, useCommandBar } from "../command-bar";
import { useWorkspace } from "../context";

export const AppRoute = (
  <Route
    component={(props) => {
      const appContext = createAppContext();
      return (
        <Show when={appContext.ready}>
          <Show
            when={appContext.app}
            fallback={
              <NotFound header inset="header" message="App not found" />
            }
          >
            <AppContext.Provider value={appContext}>
              <Commands />
              <HeaderProvider>{props.children}</HeaderProvider>
            </AppContext.Provider>
          </Show>
        </Show>
      );
    }}
  >
    <Route path="settings" component={Settings} />
    <Route path="autodeploy">{Autodeploy}</Route>
    <Route path=":stageName">{StageRoute}</Route>
    <Route path="" component={Overview} />
    <Route path="*" component={() => <NotFound header />} />
  </Route>
);

function Commands() {
  const bar = useCommandBar();
  const workspace = useWorkspace();
  const nav = useNavigate();
  const appContext = useAppContext();
  bar.register("app", async () => {
    return [
      NavigationAction({
        title: "Settings",
        category: "App",
        nav,
        path: ["", workspace().slug, appContext.app.name, "settings"].join("/"),
      }),
      NavigationAction({
        title: "Autodeploy",
        category: "App",
        nav,
        path: ["", workspace().slug, appContext.app.name, "autodeploy"].join(
          "/",
        ),
      }),
      NavigationAction({
        title: "Stages",
        category: "App",
        nav,
        path: ["", workspace().slug, appContext.app.name].join("/"),
      }),
    ];
  });

  return null;
}
