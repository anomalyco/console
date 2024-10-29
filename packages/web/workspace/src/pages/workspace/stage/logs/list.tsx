import {
  For,
  Show,
  Match,
  Switch,
  createMemo,
  createSignal,
  createEffect,
} from "solid-js";
import {
  IconFunction,
  IconGoRuntime,
  IconJavaRuntime,
  IconNodeRuntime,
  IconRustRuntime,
  IconPythonRuntime,
  IconDotNetRuntime,
  IconContainerRuntime,
} from "$/ui/icons/custom";
import { flatMap, groupBy, mapValues, pipe, sortBy, values } from "remeda";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Dropdown } from "$/ui/dropdown";
import { styled } from "@macaron-css/solid";
import { useStageContext } from "../context";
import { StateResourceStore } from "$/data/app";
import type { State } from "@console/core/state";
import { Link, useNavigate } from "@solidjs/router";
import { Row, Stack, Fullscreen } from "$/ui/layout";
import { useReplicache } from "$/providers/replicache";
import { IconCheck, IconEllipsisVertical } from "$/ui/icons";
import { formatBytes, formatDuration } from "$/common/format";
import { Tag } from "$/ui/tag";
import { createEvent } from "@console/core/event";

const Content = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const Card = styled("div", {
  base: {
    borderRadius: 4,
    backgroundColor: theme.color.background.surface,
  },
  variants: {
    outline: {
      true: {
        backgroundColor: "transparent",
        border: `1px solid ${theme.color.divider.base}`,
      },
    },
  },
});

const HeaderRoot = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[4]}`,
    height: 50,
    gap: theme.space[6],
  },
});

const HeaderTitle = styled("span", {
  base: {
    color: theme.color.text.primary.surface,
    fontWeight: theme.font.weight.medium,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.primary.base,
      },
    },
  },
});

const Children = styled("div", {
  base: {
    ...utility.stack(0),
    padding: `0 ${theme.space[3]} 0 ${theme.space[4]}`,
    borderTop: `1px solid ${theme.color.divider.surface}`,
    ":empty": {
      display: "none",
    },
  },
  variants: {
    outline: {
      true: {
        borderColor: theme.color.divider.base,
      },
    },
  },
});

const Child = styled("div", {
  base: {
    ...utility.row(4),
    padding: `${theme.space[4]} 0`,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${theme.color.divider.surface}`,
    selectors: {
      "&:last-child": {
        border: "none",
      },
    },
  },
  variants: {
    outline: {
      true: {
        borderColor: theme.color.divider.base,
      },
    },
  },
});

const ChildColLeft = styled("div", {
  base: {
    ...utility.stack(1.5),
    minWidth: 0,
  },
});

const ChildColRight = styled("div", {
  base: {
    ...utility.row(6),
    flex: "0 0 auto",
    alignItems: "center",
  },
});

const ChildTitleLink = styled(Link, {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
  },
});

const ChildDesc = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.secondary.surface,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.secondary.base,
      },
    },
  },
});

const ChildTagline = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.surface,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.dimmed.base,
      },
    },
  },
});

const ChildDetail = styled("div", {
  base: {
    ...utility.stack(1.5),
    width: 100,
  },
});

const ChildDetailLabel = styled("div", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.surface,
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.dimmed.base,
      },
    },
  },
});

const ChildDetailValue = styled("div", {
  base: {
    ...utility.text.line,
    display: "flex",
    alignItems: "baseline",
    color: theme.color.text.secondary.surface,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    textAlign: "right",
    lineHeight: "normal",
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.dimmed.base,
      },
    },
  },
});

const ChildDetailValueUnit = styled("span", {
  base: {
    fontSize: theme.font.size.xs,
  },
});

const ChildDetailLive = styled("div", {
  base: {
    width: 100,
  },
});

const ChildIcon = styled("div", {
  base: {
    flexShrink: 0,
    height: 20,
    width: 20,
    color: theme.color.icon.dimmed,
  },
});

const EmptyResourcesCopy = styled("span", {
  base: {
    fontSize: theme.font.size.lg,
    color: theme.color.text.dimmed.base,
  },
});

export function List() {
  const rep = useReplicache();
  const ctx = useStageContext();
  const resources = StateResourceStore.forStage.watch(rep, () => [
    ctx.stage.id,
  ]);

  const logs = createMemo(() =>
    pipe(
      resources(),
      flatMap((r) => {
        const name = r.urn.split("::").at(-1)!;
        if (r.type === "aws:cloudwatch/logGroup:LogGroup")
          return [
            {
              name,
              title: r.outputs?.id,
              link: `aws/logs?logGroup=${r.outputs?.id}&view=past&hint=normal`,
              type: r.type,
              logGroup: r.outputs?.id,
              priority: 1,
            },
          ];

        if (r.type === "aws:lambda/function:Function") {
          const logGroup = r.outputs?.loggingConfig?.logGroup;
          return [
            {
              name,
              title: name,
              link: `aws/logs?functionID=${r.urn}&view=past&hint=lambda`,
              type: r.type,
              logGroup,
              priority: 2,
            },
          ];
        }
        if (r.type === "sst:aws:Function") {
          const lambda = resources().find(
            (child) =>
              child.type === "aws:lambda/function:Function" &&
              child.parent === r.urn,
          );
          const logGroup = lambda?.outputs?.loggingConfig?.logGroup;
          return [
            {
              name,
              title: r.outputs?._metadata.handler,
              link: r.outputs?._live
                ? `aws/logs?functionID=${r.urn}&view=local&hint=lambda`
                : `aws/logs?logGroup=${logGroup}&view=past&hint=lambda`,
              type: r.type,
              logGroup,
              priority: 3,
            },
          ];
        }
        if (r.type === "sst:aws:Service") {
          const logGroup = resources().find(
            (child) =>
              child.type === "aws:cloudwatch/logGroup:LogGroup" &&
              child.parent === r.urn,
          )?.outputs?.id;

          return [
            {
              name,
              title: name,
              link: `aws/logs?logGroup=${logGroup}&view=past&hint=normal`,
              type: r.type,
              logGroup: logGroup,
              priority: 3,
            },
          ];
        }
        return [];
      }),
      groupBy((item) => item.logGroup),
      mapValues((items) => sortBy(items, (item) => item.priority).at(-1)!),
      values(),
      sortBy((item) => item.title),
    ),
  );

  createEffect(() => console.log(logs()));

  return (
    <Switch>
      <Match when={logs().length}>
        <Content>
          <Stack space="4">
            <Card>
              <HeaderRoot>
                <HeaderTitle>Logs</HeaderTitle>
              </HeaderRoot>
              <Children>
                <For each={logs()}>
                  {(log) => (
                    <Child outline={false}>
                      <ChildColLeft>
                        <Row space="3" vertical="center">
                          <ChildTitleLink href={log?.link}>
                            {log?.title}
                          </ChildTitleLink>
                        </Row>
                        <Row space="2">
                          <ChildDesc outline={false}>{log?.name}</ChildDesc>
                          <ChildTagline outline={false}>
                            {log?.type}
                          </ChildTagline>
                        </Row>
                      </ChildColLeft>
                    </Child>
                  )}
                </For>
              </Children>
            </Card>
          </Stack>
        </Content>
      </Match>
      <Match when={true}>
        <Fullscreen inset="header-tabs">
          <EmptyResourcesCopy>
            Deploy a function to get started!
          </EmptyResourcesCopy>
        </Fullscreen>
      </Match>
    </Switch>
  );
}
