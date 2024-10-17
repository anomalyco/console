// import "./providers/freshpaint";

import "@fontsource/rubik/latin.css";
import "@fontsource/ibm-plex-mono/latin.css";
import { styled } from "@macaron-css/solid";
import { darkClass, lightClass, theme } from "./ui/theme";
import { globalStyle, macaron$ } from "@macaron-css/core";
import { Match, Switch, onCleanup, Component, createSignal } from "solid-js";
import { Navigate, Route, Router, Routes, useNavigate } from "@solidjs/router";
import { Auth, Code } from "./pages/auth";
import { RealtimeProvider } from "./providers/realtime";
import { CommandBar, useCommandBar } from "./pages/workspace/command-bar";
import { Debug } from "./pages/debug";
import { Design } from "./pages/design";
import { Workspace } from "./pages/workspace";
import { WorkspaceCreate } from "./pages/workspace-create";
import { IconAddCircle, IconWorkspace } from "./ui/icons/custom";
import { LocalProvider } from "./providers/local";
import { useStorage } from "./providers/account";
import { DummyConfigProvider, DummyProvider } from "./providers/dummy";
import { InvocationProvider } from "./providers/invocation";
import { FlagsProvider } from "./providers/flags";
import { NotFound } from "./pages/not-found";
import { Local } from "./pages/local";
import { ReplicacheStatusProvider } from "./providers/replicache-status";
import { AuthProvider2, useAuth2 } from "./providers/auth2";

const Root = styled("div", {
  base: {
    inset: 0,
    lineHeight: 1,
    fontFamily: theme.font.family.body,
    fontSynthesis: "none",
    textRendering: "geometricPrecision",
    backgroundColor: theme.color.background.base,
  },
});

globalStyle("html", {
  fontSize: 16,
  fontWeight: 400,
  // Hardcode colors
  "@media": {
    "(prefers-color-scheme: light)": {
      backgroundColor: "#FFFFFF",
    },
    "(prefers-color-scheme: dark)": {
      backgroundColor: "#1A1A2D",
    },
  },
});

globalStyle("h1, h2, h3, h4, h5, h6, p", {
  margin: 0,
});

globalStyle("b", {
  fontWeight: 500,
});

globalStyle("pre", {
  margin: 0,
});

globalStyle("a", {
  textDecoration: "none",
  color: theme.color.link.primary.base,
  transition: `color ${theme.colorFadeDuration} ease-out`,
});

globalStyle("a:hover", {
  color: theme.color.link.primary.hover,
});

globalStyle(`a[href^="http"]`, {
  cursor: "pointer",
});

globalStyle("*:focus", {
  border: 0,
  outline: 0,
});

macaron$(() =>
  ["::placeholder", ":-ms-input-placeholder"].forEach((selector) =>
    globalStyle(selector, {
      opacity: 1,
      color: theme.color.text.dimmed.base,
    }),
  ),
);

globalStyle("body", {
  cursor: "default",
});

globalStyle("*", {
  boxSizing: "border-box",
});

globalStyle("input", {
  cursor: "text",
});

globalStyle("button", {
  padding: 0,
  border: "none",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  outline: "inherit",
  background: "none",
  textAlign: "inherit",
});

macaron$(() =>
  [
    "input::-webkit-datetime-edit-day-field:focus",
    "input::-webkit-datetime-edit-hour-field:focus",
    "input::-webkit-datetime-edit-year-field:focus",
    "input::-webkit-datetime-edit-month-field:focus",
    "input::-webkit-datetime-edit-minute-field:focus",
    "input::-webkit-datetime-edit-second-field:focus",
    "input::-webkit-datetime-edit-meridiem-field:focus",
    "input::-webkit-datetime-edit-millisecond-field:focus",
  ].forEach((selector) =>
    globalStyle(selector, {
      // Mimic WebKit text selection color
      backgroundColor: "#B4D5FE",
    }),
  ),
);

globalStyle("ul, ol", {
  margin: 0,
  padding: 0,
});

export const App: Component = () => {
  const [theme, setTheme] = createSignal<string>(
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );

  const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
  const setColorScheme = (e: MediaQueryListEvent) => {
    setTheme(e.matches ? "dark" : "light");
  };
  darkMode.addEventListener("change", setColorScheme);
  onCleanup(() => {
    darkMode.removeEventListener("change", setColorScheme);
  });
  const storage = useStorage();

  return (
    <Root class={theme() === "light" ? lightClass : darkClass} id="styled">
      <Router>
        <Routes>
          <Route path="auth/*" component={Auth} />
          <Route
            path="*"
            element={
              <CommandBar>
                <AuthProvider2>
                  <ReplicacheStatusProvider>
                    <DummyProvider>
                      <DummyConfigProvider>
                        <FlagsProvider>
                          <RealtimeProvider />
                          <LocalProvider>
                            <InvocationProvider>
                              <GlobalCommands />
                              <Routes>
                                <Route path="local/*" component={Local} />
                                <Route path="debug" component={Debug} />
                                <Route path="design" component={Design} />
                                <Route
                                  path="workspace"
                                  component={WorkspaceCreate}
                                />
                                <Route
                                  path=":workspaceSlug/*"
                                  component={Workspace}
                                />
                                <Route path="/auth/code" component={Code} />
                                <Route
                                  path=""
                                  component={() => {
                                    const auth = useAuth2();
                                    console.log(
                                      "HERE",
                                      auth.current.workspaces,
                                    );

                                    return (
                                      <Switch>
                                        <Match
                                          when={
                                            auth.current.workspaces.length > 0
                                          }
                                        >
                                          <Navigate
                                            href={`/${
                                              (
                                                auth.current.workspaces.find(
                                                  (w) =>
                                                    w.id ===
                                                    storage.value.workspace,
                                                ) || auth.current.workspaces[0]
                                              ).slug
                                            }`}
                                          />
                                        </Match>
                                        <Match when={true}>
                                          <Navigate href={`/workspace`} />
                                        </Match>
                                      </Switch>
                                    );
                                  }}
                                />
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </InvocationProvider>
                          </LocalProvider>
                        </FlagsProvider>
                      </DummyConfigProvider>
                    </DummyProvider>
                  </ReplicacheStatusProvider>
                </AuthProvider2>
              </CommandBar>
            }
          />
        </Routes>
      </Router>
    </Root>
  );
};

function GlobalCommands() {
  const bar = useCommandBar();
  const auth = useAuth2();
  const storage = useStorage();
  const nav = useNavigate();
  bar.register("workspace-switcher", async () => {
    const workspaces = auth.all.flatMap((account) =>
      account.workspaces.map((w) => ({
        accountID: account.token,
        workspace: w,
      })),
    );
    const splits = location.pathname.split("/");
    return [
      ...workspaces
        .filter((item) => item.workspace?.slug !== splits[1])
        .map((item) => ({
          title: `Switch to ${item.workspace.slug} workspace`,
          category: "Workspace",
          icon: IconWorkspace,
          run: (control: any) => {
            console.log("switching to", item.accountID, item.workspace.slug);
            auth.switch(item.accountID);
            nav(`/${item.workspace.slug}`);
            control.hide();
          },
        })),
      {
        icon: IconAddCircle,
        category: "Workspace",
        title: "Create new workspace",
        run: (control) => {
          nav("/workspace");
          control.hide();
        },
      },
    ];
  });
  return undefined;
}
