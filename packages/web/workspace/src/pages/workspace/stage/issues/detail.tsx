import { theme } from "@console/web/ui/theme";
import { A, useParams } from "@solidjs/router";
import { styled } from "@macaron-css/solid";
import { Show, Switch, Match, createMemo, createEffect, For, onMount, createResource } from "solid-js";
import { IconCheck, IconNoSymbol } from "@console/web/ui/icons";
import { IconCaretRight, IconArrowPathSpin } from "@console/web/ui/icons/custom";
import { formatSinceTime, parseTime } from "@console/web/common/format";
import { IssueCountStore, IssueStore } from "@console/web/data/issue";
import { useReplicache } from "@console/web/providers/replicache";
import { DateTime, Interval } from "luxon";
import { StackTrace } from "../logs/error";
import { Log, LogTime, LogMessage } from "@console/web/common/invocation";
import { fromEntries } from "remeda";
import { useStageContext } from "../context";
import { useLocalLogs } from "@console/web/providers/invocation";
import { useCommandBar } from "../../command-bar";
import { useReplicacheStatus } from "@console/web/providers/replicache-status";
import { NotFound } from "@console/web/pages/not-found";
import { ButtonGroup } from "@console/web/ui/button";
import { Histogram } from "@console/web/ui/histogram";
import { Stack, Row } from "@console/web/ui/layout";
import { Tag } from "@console/web/ui/tag";
import { utility } from "@console/web/ui/utility";
import { Text } from "@console/web/ui/text";
import { Button } from "@console/web/ui/button";
import { Alert } from "@console/web/ui/alert";
import { Invocation } from "@console/core/log/index";
import { useApi } from "../../context";

const DATETIME_NO_TIME = {
  month: "short",
  day: "numeric",
  year: "numeric",
} as const;

const Container = styled("div", {
  base: {
    ...utility.row(6),
    padding: theme.space[4],
  },
});

const Content = styled("div", {
  base: {
    flex: "1 1 auto",
  },
});

const Sidebar = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 300,
  },
});

const PanelTitle = styled("span", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
  },
});

const StackTraceBackground = styled("div", {
  base: {
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    overflow: "hidden",
  },
});

export const StackTraceEmpty = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: theme.space[5],
  },
});

export const PanelEmptyCopy = styled("span", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.surface,
  },
});

export const LogsBackground = styled("div", {
  base: {
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    padding: `0 ${theme.space[4]}`,
  },
});

export const LogsLoading = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: `${theme.space[4]} 0`,
    borderTop: `1px solid ${theme.color.divider.surface}`,
    selectors: {
      "&:first-child": {
        borderTop: "none",
      },
    },
  },
  variants: {
    slim: {
      true: {
        padding: `${theme.space[3.5]} 0`,
      },
      false: {},
    },
  },
});

export const LogsLoadingIcon = styled("div", {
  base: {
    width: 16,
    height: 16,
    opacity: theme.iconOpacity,
    color: theme.color.text.dimmed.surface,
  },
});

const FunctionLink = styled(A, {
  base: {
    cursor: "pointer",
    wordBreak: "break-all",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    lineHeight: theme.font.lineHeight,
  },
});

const ButtonIcon = styled("span", {
  base: {
    width: 14,
    height: 14,
    marginRight: 6,
    verticalAlign: -2,
    display: "inline-block",
    opacity: theme.iconOpacity,
  },
});
const FeedbackCopy = styled("span", {
  base: {
    lineHeight: 1.4,
    fontSize: theme.font.size.sm,
  },
});

export function Detail() {
  const params = useParams();
  const ctx = useStageContext();
  const rep = useReplicache();
  const invocations = useLocalLogs();
  const issue = IssueStore.get.watch(rep, () => [ctx.stage.id, params.issueID]);
  const replicacheStatus = useReplicacheStatus();

  const status = createMemo(() => {
    if (issue()?.timeIgnored) return "ignored";
    if (issue()?.timeResolved) return "resolved";
    return "active";
  });
  const api = useApi();

  const [logs] = createResource(() => issue()?.pointer, async (pointer) => {
    if (!pointer) return;
    return api.client.log.aws.expand
      .$get({
        query: {
          stageID: ctx.stage.id,
          group: pointer.logGroup,
          stream: pointer.logStream,
          timestamp: pointer.timestamp as any,
        },
      }).then((r) => r.json());
  })


  const min = DateTime.now()
    .startOf("hour")
    .minus({ hours: 24 })
    .toSQL({ includeOffset: false })!;

  const counts = IssueCountStore.forIssue.watch(
    rep,
    () => [issue()?.group || "unknown"],
    (items) => items.filter((item) => item.hour > min),
  );
  const histogram = createMemo(() => {
    const hours = fromEntries(
      counts().map((item) => [
        parseTime(item.hour).toSQL({ includeOffset: false })!,
        item.count,
      ]),
    );
    return Interval.fromDateTimes(
      DateTime.now().toUTC().startOf("hour").minus({ hours: 23 }),
      DateTime.now().toUTC().startOf("hour").plus({ hours: 1 }),
    )
      .splitBy({ hours: 1 })
      .map((interval) => interval.start!.toSQL({ includeOffset: false })!)
      .map((hour) => ({ label: hour, value: hours[hour] || 0 }));
  });


  const bar = useCommandBar();
  bar.register("issues-detail", async () => {
    return [
      {
        icon: IconCaretRight,
        title: "Resolve",
        run: (control) => {
          rep().mutate.issue_resolve([issue()!.id]);
          control.hide();
        },
        disabled: Boolean(issue().timeResolved),
        category: "Issue",
      },
      {
        icon: IconCaretRight,
        title: "Unresolve",
        run: (control) => {
          rep().mutate.issue_unresolve([issue()!.id]);
          control.hide();
        },
        disabled: !issue().timeResolved,
        category: "Issue",
      },
      {
        icon: IconCaretRight,
        title: "Ignore",
        run: (control) => {
          rep().mutate.issue_ignore([issue()!.id]);
          control.hide();
        },
        disabled: Boolean(issue().timeIgnored),
        category: "Issue",
      },
      {
        icon: IconCaretRight,
        title: "Unignore",
        run: (control) => {
          rep().mutate.issue_unignore([issue()!.id]);
          control.hide();
        },
        disabled: !issue().timeIgnored,
        category: "Issue",
      },
    ];
  });

  return (
    <Switch>
      <Match
        when={replicacheStatus.isSynced(rep().name) && !issue() && issue.ready}
      >
        <NotFound inset="header-tabs" />
      </Match>
      <Match when={issue()}>
        <Container>
          <Content>
            <Stack space="7">
              <Stack space="2">
                <Text break size="xl" weight="medium">
                  {issue().error}
                </Text>
                <Stack space="0" horizontal="start">
                  <Text break leading="loose">
                    {issue().message}
                  </Text>
                </Stack>
              </Stack>
              <Stack space="2">
                <PanelTitle>Stack Trace</PanelTitle>
                <Show when={false}>
                  <Alert level="info">
                    Enable source maps to view the original stack trace.
                  </Alert>
                </Show>
                <StackTraceBackground>
                  <Show
                    when={issue().stack?.length}
                    fallback={
                      <StackTraceEmpty>
                        <PanelEmptyCopy>
                          No stack trace available
                        </PanelEmptyCopy>
                      </StackTraceEmpty>
                    }
                  >
                    <StackTrace stack={issue().stack || []} />
                  </Show>
                </StackTraceBackground>
              </Stack>
              <Stack space="2">
                <Show
                  when={logs()?.length}
                  fallback={<PanelTitle>Logs</PanelTitle>}
                >
                  <PanelTitle
                    title={DateTime.fromMillis(logs()![0].timestamp!)
                      .toUTC()
                      .toLocaleString(DateTime.DATETIME_FULL)}
                  >
                    Logs —{" "}
                    {DateTime.fromMillis(
                      logs()![0].timestamp!,
                    ).toLocaleString(DATETIME_NO_TIME)}
                  </PanelTitle>
                </Show>
                <LogsBackground>
                  <Show
                    when={!logs.loading}
                    fallback={
                      <LogsLoading>
                        <LogsLoadingIcon>
                          <IconArrowPathSpin />
                        </LogsLoadingIcon>
                        <PanelEmptyCopy>Loading logs &hellip;</PanelEmptyCopy>
                      </LogsLoading>
                    }
                  >
                    <For each={logs() || []}>
                      {(entry) => (
                        <Log>
                          <LogTime
                            title={DateTime.fromMillis(entry.timestamp)
                              .toUTC()
                              .toLocaleString(
                                DateTime.DATETIME_FULL_WITH_SECONDS,
                              )}
                          >
                            {DateTime.fromMillis(entry.timestamp).toFormat(
                              "HH:mm:ss.SSS",
                            )}
                          </LogTime>
                          <LogMessage>{entry.message}</LogMessage>
                        </Log>
                      )}
                    </For>
                  </Show>
                </LogsBackground>
              </Stack>
            </Stack>
          </Content>
          <Sidebar>
            <Stack space="7">
              <Show
                when={
                  !Boolean(issue().timeIgnored) &&
                  !Boolean(issue().timeResolved)
                }
                fallback={
                  <Button
                    color="secondary"
                    onClick={() =>
                      issue().timeIgnored
                        ? rep().mutate.issue_unignore([issue()!.id])
                        : rep().mutate.issue_unresolve([issue()!.id])
                    }
                  >
                    Reopen Issue
                  </Button>
                }
              >
                <ButtonGroup>
                  <Button
                    grouped="left"
                    color="secondary"
                    style={{ flex: "1 1 auto" }}
                    onClick={() => rep().mutate.issue_ignore([issue()!.id])}
                  >
                    <ButtonIcon>
                      <IconNoSymbol />
                    </ButtonIcon>
                    Ignore
                  </Button>
                  <Button
                    grouped="right"
                    color="secondary"
                    style={{ flex: "1 1 auto" }}
                    onClick={() => rep().mutate.issue_resolve([issue()!.id])}
                  >
                    <ButtonIcon>
                      <IconCheck />
                    </ButtonIcon>
                    Resolve
                  </Button>
                </ButtonGroup>
              </Show>
              <Stack space="2">
                <PanelTitle>Last 24hrs</PanelTitle>
                <Histogram
                  width={300}
                  height={40}
                  units="Errors"
                  currentTime={Date.now()}
                  data={histogram()}
                />
              </Stack>
              <Stack space="2">
                <PanelTitle>Status</PanelTitle>
                <Row>
                  <Switch>
                    <Match when={status() === "active"}>
                      <Tag level="caution">Active</Tag>
                    </Match>
                    <Match when={status() === "ignored"}>
                      <Tag level="info">Ignored</Tag>
                    </Match>
                    <Match when={status() === "resolved"}>
                      <Tag level="tip">Resolved</Tag>
                    </Match>
                  </Switch>
                </Row>
              </Stack>
              <Stack space="2">
                <PanelTitle>Last Seen</PanelTitle>
                <Text
                  title={parseTime(issue().timeSeen).toLocaleString(
                    DateTime.DATETIME_FULL,
                  )}
                  color="secondary"
                >
                  {formatSinceTime(issue().timeSeen, true)}
                </Text>
              </Stack>
              <Stack space="2">
                <PanelTitle>First Seen</PanelTitle>
                <Text
                  title={parseTime(issue().timeCreated).toLocaleString(
                    DateTime.DATETIME_FULL,
                  )}
                  color="secondary"
                >
                  {formatSinceTime(issue().timeCreated, true)}
                </Text>
              </Stack>
              <Stack space="2">
                <PanelTitle>Feedback</PanelTitle>
                <FeedbackCopy>
                  <Text size="sm" color="secondary">
                    Does something not look right?
                  </Text>{" "}
                  <a
                    target="_blank"
                    rel="noreferrer noopener"
                    href="https://github.com/sst/console/issues/new"
                  >
                    Open an issue in GitHub.
                  </a>
                </FeedbackCopy>
              </Stack>
            </Stack>
          </Sidebar>
        </Container>
      </Match>
    </Switch>
  );
}
