// import "./providers/freshpaint";

import "@fontsource/rubik/latin.css";
import "@fontsource/ibm-plex-mono/latin.css";
import { styled } from "@macaron-css/solid";
import { darkClass, lightClass, theme } from "./ui/theme";
import { globalStyle, macaron$ } from "@macaron-css/core";
import { Match, Switch, onCleanup, Component, createSignal, createEffect } from "solid-js";
import { Navigate, Route, Router, useNavigate } from "@solidjs/router";
import { Auth } from "./pages/auth";
import { CommandBar, useCommandBar } from "./pages/workspace/command-bar";
import { DebugRoute } from "./pages/debug";
import { Design } from "./pages/design";
import { WorkspaceRoute } from "./pages/workspace";
import { WorkspaceCreate } from "./pages/workspace-create";
import { IconAddCircle, IconWorkspace } from "./ui/icons/custom";
import { LocalProvider } from "./providers/local";
import { AccountProvider, useAccount, useStorage } from "./providers/account";
import { DummyConfigProvider, DummyProvider } from "./providers/dummy";
import { LocalLogsProvider } from "./providers/invocation";
import { FlagsProvider } from "./providers/flags";
import { NotFound } from "./pages/not-found";
import { Local } from "./pages/local";
import { ReplicacheStatusProvider } from "./providers/replicache-status";
import { RealtimeProvider } from "./providers/realtime";
import { OpenAuthProvider, useOpenAuth } from "@openauthjs/solid";

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

const legacyAuth = JSON.parse(localStorage.getItem("radiant.auth") || "{}")
if (legacyAuth.accounts) {
  const migrate = {
    subjects: {} as Record<string, any>,
    current: undefined,
  }
  for (const item of Object.values<any>(legacyAuth.accounts)) {
    console.log(item)
    const splits = item.refresh.split(":")
    splits.pop()
    const id = splits.join(":")
    migrate.subjects[id] = {
      id,
      refresh: item.refresh,
    }
    if (item.id === legacyAuth.current) {
      migrate.current = id
    }
  }
  console.log("migrated", migrate)
  localStorage.setItem(`${import.meta.env.VITE_AUTH_URL}.auth`, JSON.stringify(migrate))
  localStorage.removeItem("radiant.auth")
}

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
    <OpenAuthProvider
      issuer={import.meta.env.VITE_AUTH_URL}
      clientID="web"
    >
      <Root class={theme() === "light" ? lightClass : darkClass} id="styled">
        <Router>
          <Route>
            <Route path="/auth">{Auth}</Route>
            <Route
              path="*"
              component={(props) => (
                <CommandBar>
                  <AccountProvider>
                    <RealtimeProvider />
                    <ReplicacheStatusProvider>
                      <DummyProvider>
                        <DummyConfigProvider>
                          <FlagsProvider>
                            <LocalProvider>
                              <LocalLogsProvider>
                                <GlobalCommands />
                                {props.children}
                              </LocalLogsProvider>
                            </LocalProvider>
                          </FlagsProvider>
                        </DummyConfigProvider>
                      </DummyProvider>
                    </ReplicacheStatusProvider>
                  </AccountProvider>
                </CommandBar>
              )}
            >
              <Route path="local" component={Local} />
              <Route path="debug" component={DebugRoute} />
              <Route path="design" component={Design} />
              <Route path="workspace" component={WorkspaceCreate} />
              <Route path=":workspaceSlug">{WorkspaceRoute}</Route>
              <Route
                path="/"
                component={() => {
                  console.log("here");
                  const auth = useOpenAuth();
                  const account = useAccount()
                  return (
                    <Switch>
                      <Match when={account.current.workspaces.length > 0}>
                        <Navigate
                          href={`/${(
                            account.current.workspaces.find(
                              (w) => w.id === storage.value.workspace,
                            ) || account.current.workspaces[0]
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
              <Route path="*" component={() => <NotFound />} />
            </Route>
          </Route>
        </Router>
      </Root>
    </OpenAuthProvider>
  );
};

function GlobalCommands() {
  const bar = useCommandBar();
  const auth = useOpenAuth();
  const account = useAccount()
  const nav = useNavigate();
  bar.register("workspace-switcher", async () => {
    const workspaces = Object.values(account.all).flatMap((account) =>
      account.workspaces.map((w) => ({
        accountID: account.id,
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
