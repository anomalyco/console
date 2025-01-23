import { CSSProperties } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { A } from "@solidjs/router";
import { WorkspaceContext } from "./context";
import { useCommandBar } from "./command-bar";
import {
  JSX,
  Show,
  Match,
  Switch,
  onCleanup,
  useContext,
  ParentProps,
  createEffect,
  createSignal,
} from "solid-js";
import { dropAllDatabases } from "replicache";
import { createInitializedContext } from "../../common/context";
import { AvatarInitialsIcon } from "../../ui/avatar-icon";
import { TextButton } from "../../ui/button";
import { IconChevronUpDown, IconMagnifyingGlass } from "../../ui/icons";
import { IconApp } from "../../ui/icons/custom";
import { Row } from "../../ui/layout";
import { theme } from "../../ui/theme";
import { utility } from "../../ui/utility";

const breadCrumbStyles: CSSProperties = {
  flexShrink: 0,
  maxWidth: 240,
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: theme.space[1],
  font: theme.font.family.heading,
};

const breadCrumbFirstStyles: CSSProperties = {
  borderLeft: `1px solid ${theme.color.divider.base}`,
  paddingLeft: `calc(${theme.space[4]} - 1px)`,
};

const Root = styled("div", {
  base: {
    top: "0",
    zIndex: 10,
    position: "sticky",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    backgroundColor: theme.color.background.navbar,
    borderBottom: `1px solid ${theme.color.divider.base}`,
    padding: `0 ${theme.space[4]}`,
    height: theme.headerHeight.root,
  },
});

const Breadcrumbs = styled("div", {
  base: {
    ...utility.row(0),
    alignItems: "center",
  },
});

const WorkspaceLogoLink = styled(A, {
  base: {
    display: "flex",
  },
});

const SSTConsoleTitle = styled(A, {
  base: {
    ...breadCrumbStyles,
    ...breadCrumbFirstStyles,
  },
});

const SSTIcon = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    color: "#FFFBF9",
    backgroundColor: "#395C6B",
    borderRadius: theme.borderRadius,
  },
});

const Breadcrumb = styled("div", {
  base: {
    ...breadCrumbStyles,
  },
  variants: {
    first: {
      true: breadCrumbFirstStyles,
    },
  },
});

const BreadcrumbCopy = styled(A, {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    color: theme.color.text.dimmed.base,
    ":hover": {
      color: theme.color.text.dimmed.base,
    },
  },
  variants: {
    first: {
      true: {
        color: theme.color.text.secondary.base,
        fontWeight: theme.font.weight.medium,
        ":hover": {
          color: theme.color.text.secondary.base,
        },
      },
    },
  },
});

const BreadcrumbSeparator = styled("div", {
  base: {
    paddingInlineStart: `calc(${theme.space[4]} - 4px)`,
    paddingInlineEnd: `calc(${theme.space[4]} - 2px)`,
    color: theme.color.divider.base,
    fontSize: theme.font.size.lg,
    lineHeight: 1,
  },
});

const SSTConsoleTitleCopy = styled("span", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.secondary.base,
  },
});

const Switcher = styled("button", {
  base: {
    flex: "0 0 auto",
    lineHeight: 0,
  },
});

const SwitcherIcon = styled(IconChevronUpDown, {
  base: {
    opacity: theme.iconOpacity,
    color: theme.color.text.dimmed.base,
    width: 20,
    height: 20,
  },
});

const JumpToButton = styled("button", {
  base: {
    ...utility.row(9),
    height: 36,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.input.background,
    border: `1px solid ${theme.color.divider.surface}`,
    padding: `0 ${theme.space[1.5]} 0 ${theme.space[2.5]}`,
  },
});

const JumpToButtonKeys = styled("div", {
  base: {
    letterSpacing: 0.5,
    fontSize: theme.font.size.mono_xs,
    padding: `${theme.space[1]} ${theme.space[1.5]}`,
    alignItems: "center",
    textTransform: "uppercase",
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.divider.surface,
    lineHeight: "normal",
    color: theme.color.text.dimmed.surface,
  },
});

const JumpToButtonCopy = styled("span", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

const LogoutButton = styled(TextButton, {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
    ":hover": {
      color: theme.color.text.secondary.base,
    },
  },
});

export const PageHeader = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    padding: `0 ${theme.space[4]}`,
    justifyContent: "space-between",
    height: theme.headerHeight.stage,
    borderBottom: `1px solid ${theme.color.divider.base}`,
  },
});

function isMac() {
  return navigator.userAgent.toUpperCase().indexOf("MAC") !== -1;
}

export const { provider: HeaderProvider, use: useHeaderContext } =
  createInitializedContext("HeaderContext", () => {
    const [children, setChildren] = createSignal<JSX.Element>();
    return {
      set: setChildren,
      clear: () => setChildren(undefined),
      get children() {
        return children();
      },
      get ready() {
        return true;
      },
    };
  });

export function HeaderSlot(props: ParentProps) {
  const ctx = useHeaderContext();
  createEffect(() => {
    ctx.set(props.children);
  });

  onCleanup(() => {
    ctx.clear();
  });

  return null;
}

export function Header(props: { app?: string; stage?: string }) {
  const workspace = useContext(WorkspaceContext);
  const bar = useCommandBar();

  return (
    <Root>
      <Row space="4" vertical="center">
        <Show
          when={workspace}
          fallback={
            <>
              <A href="/">
                <SSTIcon>
                  <IconApp width="20" height="20" />
                </SSTIcon>
              </A>
              <SSTConsoleTitle href="/">
                <SSTConsoleTitleCopy>Console</SSTConsoleTitleCopy>
              </SSTConsoleTitle>
            </>
          }
        >
          <WorkspaceLogoLink href={`/${workspace!().slug}`}>
            <AvatarInitialsIcon type="workspace" text={workspace!().slug} />
          </WorkspaceLogoLink>
          <Breadcrumbs>
            <Breadcrumb first>
              <BreadcrumbCopy first href={`/${workspace!().slug}`}>
                {workspace!().slug}
              </BreadcrumbCopy>
              <Show when={!props.app && !props.stage}>
                <Switcher onClick={() => bar.show("workspace-switcher")}>
                  <SwitcherIcon />
                </Switcher>
              </Show>
            </Breadcrumb>
            <Show when={props.app}>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <Breadcrumb>
                <BreadcrumbCopy href={`/${workspace!().slug}/${props.app}`}>
                  {props.app}
                </BreadcrumbCopy>
                <Show when={!props.stage}>
                  <Switcher onClick={() => bar.show("app-switcher")}>
                    <SwitcherIcon />
                  </Switcher>
                </Show>
              </Breadcrumb>
              <Show when={props.stage}>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <Breadcrumb>
                  <BreadcrumbCopy
                    href={`/${workspace!().slug}/${props.app}/${props.stage}`}
                  >
                    {props.stage}
                  </BreadcrumbCopy>
                  <Switcher onClick={() => bar.show("stage-switcher")}>
                    <SwitcherIcon />
                  </Switcher>
                </Breadcrumb>
              </Show>
            </Show>
          </Breadcrumbs>
        </Show>
      </Row>
      <Row space="4" vertical="center">
        <JumpToButton onClick={() => bar.show()}>
          <Row space="1" vertical="center">
            <IconMagnifyingGlass
              width="13"
              height="13"
              color={theme.color.icon.dimmed}
            />
            <JumpToButtonCopy>Jump to</JumpToButtonCopy>
          </Row>
          <Row space="1" vertical="center">
            <JumpToButtonKeys>
              {isMac() ? <>&#8984;</> : "Ctrl"}
            </JumpToButtonKeys>
            <JumpToButtonKeys>K</JumpToButtonKeys>
          </Row>
        </JumpToButton>
        <LogoutButton
          onClick={async () => {
            await dropAllDatabases();
            localStorage.clear();
            location.href = "/";
          }}
        >
          Logout
        </LogoutButton>
      </Row>
    </Root>
  );
}
