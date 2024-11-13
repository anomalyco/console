import { Show } from "solid-js";
import { AppContext, createAppContext, useAppContext } from "./context";
import { HeaderProvider } from "../header";
import { Route, Routes, useNavigate } from "@solidjs/router";
import { NotFound } from "$/pages/not-found";
import { Stage } from "../stage";
import { Settings } from "./settings";
import { Autodeploy } from "./autodeploy";
import { Overview } from "./overview";
import { NavigationAction, useCommandBar } from "../command-bar";
import { useWorkspace } from "../context";

export function App() {
  const appContext = createAppContext();
  const bar = useCommandBar();
  const workspace = useWorkspace();
  const nav = useNavigate();

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
        path: ["", workspace().slug, appContext.app.name, "autodeploy"].join("/"),
      }),
      NavigationAction({
        title: "Stages",
        category: "App",
        nav,
        path: ["", workspace().slug, appContext.app.name].join("/"),
      }),
    ];
  });

  return (
    <Show
      when={appContext.ready}
    >
      <Show
        when={appContext.app}
        fallback={<NotFound header inset="header" message="App not found" />}
      >
        <AppContext.Provider value={appContext}>
          <HeaderProvider>
            <Routes>
              <Route path="settings" component={Settings} />
              <Route path="autodeploy/*" component={Autodeploy} />
              <Route path=":stageName/*" component={Stage} />
              <Route path="" component={Overview} />
              <Route path="*" element={<NotFound header />} />
            </Routes>
          </HeaderProvider>
        </AppContext.Provider>
      </Show>
    </Show>
  );
}
