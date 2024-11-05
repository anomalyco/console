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
  IconConstruct,
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
import { Text } from "$/ui/text";
import { Row, Stack, Fullscreen } from "$/ui/layout";
import { useReplicache } from "$/providers/replicache";
import { IconCheck, IconEllipsisVertical } from "$/ui/icons";
import { formatBytes, formatDuration } from "$/common/format";
import { Tag } from "$/ui/tag";
import { createEvent } from "@console/core/event";

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
    color: theme.color.text.dimmed.base,
  },
});

const ChildDetailValue = styled("div", {
  base: {
    ...utility.text.line,
    display: "flex",
    alignItems: "baseline",
    color: theme.color.text.secondary.base,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    textAlign: "right",
    lineHeight: "normal",
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
              icon: "construct",
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
              icon: "function",
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
              link: r.outputs?._metadata.dev
                ? `aws/logs?functionID=${r.urn}&view=local&hint=lambda`
                : `aws/logs?logGroup=${logGroup}&view=past&hint=lambda`,
              type: r.type,
              logGroup,
              priority: 3,
              icon: "function",
            },
          ];
        }
        if (r.type === "sstv2:aws:Function") {
          console.log(r);
          const logGroup = r.outputs?.enrichment?.logGroup;
          const live = r.outputs?.enrichment?.live;
          return [
            {
              name,
              title: r.outputs?.handler,
              link: live
                ? `aws/logs?functionID=${r.outputs?.localId}&view=local&hint=lambda`
                : `aws/logs?logGroup=${logGroup}&view=past&hint=lambda`,
              type: r.type,
              logGroup,
              priority: 3,
              icon: "function",
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
              icon: "container",
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

  return (
    <Switch>
      <Match when={logs().length}>
        <Content>
          <PageHeader>
            <PageHeaderTitle>Logs</PageHeaderTitle>
            <PageHeaderDesc>Service, function, and other logs</PageHeaderDesc>
          </PageHeader>
          <Stack space="4">
            <Card>
              <For each={logs()}>
                {(log) => (
                  <Child>
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
