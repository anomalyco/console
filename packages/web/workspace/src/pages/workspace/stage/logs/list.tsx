import { For, Match, Switch, createMemo } from "solid-js";
import {
  IconFunction,
  IconConstruct,
  IconContainerRuntime,
} from "$/ui/icons/custom";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { styled } from "@macaron-css/solid";
import { useLogsContext, useStageContext } from "../context";
import { Link } from "@solidjs/router";
import { Row, Stack, Fullscreen } from "$/ui/layout";

const Content = styled("div", {
  base: {
    ...utility.stack(4),
    padding: theme.space[4],
  },
});

const PageHeader = styled("div", {
  base: {
    ...utility.stack(2.5),
    justifyContent: "center",
    height: 56,
  },
});

const PageHeaderTitle = styled("p", {
  base: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
  },
});

const PageHeaderDesc = styled("p", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
  },
});

const Card = styled("div", {
  base: {
    ...utility.stack(0),
    borderRadius: 4,
    padding: `0 ${theme.space[3]} 0 ${theme.space[4]}`,
    border: `1px solid ${theme.color.divider.base}`,
    ":empty": {
      display: "none",
    },
  },
});

const Child = styled("div", {
  base: {
    ...utility.row(4),
    position: "relative",
    padding: `${theme.space[4]} 0`,
    alignItems: "center",
    justifyContent: "left",
    borderBottom: `1px solid ${theme.color.divider.base}`,
    selectors: {
      "&:last-child": {
        border: "none",
      },
    },
  },
});

const BlockLink = styled(Link, {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

const ChildIcon = styled("div", {
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    opacity: theme.iconOpacity,
    color: theme.color.icon.secondary,
  },
});

const ChildColContent = styled("div", {
  base: {
    ...utility.stack(2),
    minWidth: 0,
  },
});

const ChildTitleLink = styled(Link, {
  base: {
    ...utility.text.line,
    zIndex: 2,
    lineHeight: "normal",
    color: theme.color.text.primary.base,
  },
});

const ChildDesc = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
  },
});

const ChildTagline = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.dimmed.base,
  },
});

const EmptyResourcesCopy = styled("span", {
  base: {
    fontSize: theme.font.size.lg,
    color: theme.color.text.dimmed.base,
  },
});

export function List() {
  const logs = useLogsContext();
  return (
    <Switch>
      <Match when={logs().length}>
        <Content>
          <PageHeader>
            <PageHeaderTitle>Logs</PageHeaderTitle>
            <PageHeaderDesc>Function, container, and other logs</PageHeaderDesc>
          </PageHeader>
          <Stack space="4">
            <Card>
              <For each={logs()}>
                {(log) => (
                  <Child>
                    <BlockLink href={log?.link}></BlockLink>
                    <ChildIcon>
                      <Switch>
                        <Match when={log.icon === "construct"}>
                          <IconConstruct width={19} height={19} />
                        </Match>
                        <Match when={log.icon === "function"}>
                          <IconFunction width={16} height={16} />
                        </Match>
                        <Match when={log.icon === "container"}>
                          <IconContainerRuntime width={20} height={20} />
                        </Match>
                      </Switch>
                    </ChildIcon>
                    <ChildColContent>
                      <Row space="3" vertical="center">
                        <ChildTitleLink href={log?.link}>
                          {log?.title}
                        </ChildTitleLink>
                      </Row>
                      <Row space="2">
                        <ChildDesc>{log?.type}</ChildDesc>
                        <ChildTagline>{log?.name}</ChildTagline>
                      </Row>
                    </ChildColContent>
                  </Child>
                )}
              </For>
            </Card>
          </Stack>
        </Content>
      </Match>
      <Match when={true}>
        <Fullscreen inset="header-tabs">
          <EmptyResourcesCopy>
            Deploy a function or service to get started!
          </EmptyResourcesCopy>
        </Fullscreen>
      </Match>
    </Switch>
  );
}
