import {
  For,
  Show,
  Match,
  Switch,
  createMemo,
  createResource,
  onCleanup,
  createEffect,
} from "solid-js";
import { createSubscription, useReplicache } from "$/providers/replicache";
import { Link, useNavigate, useParams } from "@solidjs/router";
import { RunStore, StateUpdateStore } from "$/data/app";
import { StageStore } from "$/data/stage";
import { DateTime } from "luxon";
import {
  ERROR_MAP,
  STATUS_MAP,
} from "../pages/workspace/app/autodeploy/list";
import {
  LogsLoading,
  LogsBackground,
  PanelEmptyCopy,
  LogsLoadingIcon,
} from "../pages/workspace/stage/issues/detail";
import { NotFound } from "$/pages/not-found";
import { styled } from "@macaron-css/solid";
import { globalKeyframes } from "@macaron-css/core";
import {
  IconPr,
  IconGit,
  IconCommit,
  IconArrowPathSpin,
} from "$/ui/icons/custom";
import { Log, LogTime, LogMessage } from "$/common/invocation";
import { formatCommit, formatDuration, formatSinceTime } from "$/common/format";
import { useReplicacheStatus } from "$/providers/replicache-status";
import {
  githubPr,
  githubRepo,
  githubRef,
  githubCommit,
} from "$/common/url-builder";
import { pipe, dropWhile, drop, takeWhile, filter } from "remeda";
import { useWorkspace } from "../pages/workspace/context";
import { useAuth2 } from "$/providers/auth2";
import { IconTag, IconXCircle } from "$/ui/icons";
import { utility } from "$/ui/utility";
import { theme } from "$/ui/theme";
import { Stack, Row } from "$/ui/layout";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";
import { createId } from "@paralleldrive/cuid2";

const DATETIME_NO_TIME = {
  month: "short",
  day: "numeric",
  year: "numeric",
} as const;

const STATUS_DESC_MAP = {
  queued: "Waiting…",
  skipped: undefined,
  updated: "Successfully",
  error: undefined,
  updating: "Deploying…",
};
const AVATAR_SIZE = 36;
const SIDEBAR_WIDTH = 300;

const Container = styled("div", {
  base: {
    ...utility.row(6),
    padding: theme.space[4],
  },
});

const Content = styled("div", {
  base: {
    minWidth: 0,
    flex: "1 1 auto",
  },
});

const PageTitle = styled("div", {
  base: {
    ...utility.row(3),
    paddingTop: theme.space[1.5],
    alignItems: "center",
  },
});

const PageTitleCopy = styled("h1", {
  base: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
  },
});

const RunStatusIcon = styled("div", {
  base: {
    width: 12,
    height: 12,
    borderRadius: "50%",
  },
  variants: {
    status: {
      skipped: {
        backgroundColor: theme.color.divider.base,
      },
      queued: {
        backgroundColor: theme.color.divider.base,
      },
      updated: {
        backgroundColor: `hsla(${theme.color.base.blue}, 100%)`,
      },
      error: {
        backgroundColor: `hsla(${theme.color.base.red}, 100%)`,
      },
      updating: {
        backgroundColor: `hsla(${theme.color.base.yellow}, 100%)`,
        animation: "glow-pulse-status 1.7s linear infinite alternate",
      },
    },
  },
});

globalKeyframes("glow-pulse-status", {
  "0%": {
    opacity: 0.3,
    filter: `drop-shadow(0 0 0px ${theme.color.accent})`,
  },
  "50%": {
    opacity: 1,
    filter: `drop-shadow(0 0 1px ${theme.color.accent})`,
  },
  "100%": {
    opacity: 0.3,
    filter: `drop-shadow(0 0 0px ${theme.color.accent})`,
  },
});

const PageTitleMessage = styled("p", {
  base: {
    marginLeft: `calc(${theme.space[3]} + 12px)`,
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
    lineHeight: theme.font.lineHeight,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  variants: {
    error: {
      true: {
        color: theme.color.text.danger.base,
      },
    },
  },
});

const Errors = styled("div", {
  base: {
    ...utility.stack(4),
    padding: theme.space[4],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.red,
  },
});

const Error = styled("div", {
  base: {
    ...utility.row(2),
    color: `hsla(${theme.color.red.l2}, 100%)`,
  },
});

const ErrorIcon = styled("div", {
  base: {
    flex: 0,
    marginTop: 2,
  },
});

const ErrorTitle = styled("div", {
  base: {
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    fontWeight: theme.font.weight.bold,
    lineHeight: theme.font.lineHeight,
    wordBreak: "break-all",
  },
});

const ErrorMessage = styled("div", {
  base: {
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});

const ForceCheckbox = styled("input", {
  base: {
    flex: "0 0 auto",
    zIndex: 2,
    cursor: "pointer",
  },
});

const SidebarRoot = styled("div", {
  base: {
    flex: "0 0 auto",
    width: SIDEBAR_WIDTH,
  },
});

const GitInfo = styled("div", {
  base: {
    ...utility.stack(2),
    justifyContent: "center",
    height: 44,
  },
});

const GitAvatar = styled("div", {
  base: {
    flex: "0 0 auto",
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    overflow: "hidden",
    borderRadius: theme.borderRadius,
  },
});

const GitLink = styled("a", {
  base: {
    ...utility.row(1),
    alignItems: "center",
  },
});

const GitIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    lineHeight: 0,
    color: theme.color.icon.secondary,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${GitLink}:hover &`]: {
        color: theme.color.text.primary.base,
      },
    },
  },
  variants: {
    size: {
      sm: {
        marginInline: 1,
        width: 12,
        height: 12,
        color: theme.color.icon.dimmed,
        selectors: {
          [`${GitLink}:hover &`]: {
            color: theme.color.icon.secondary,
          },
        },
      },
      md: {
        width: 14,
        height: 14,
      },
    },
  },
});

const GitCommit = styled("span", {
  base: {
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.secondary.base,
    fontWeight: theme.font.weight.medium,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${GitLink}:hover &`]: {
        color: theme.color.link.primary.hover,
      },
    },
  },
});

const GitBranch = styled("span", {
  base: {
    ...utility.text.line,
    maxWidth: SIDEBAR_WIDTH - AVATAR_SIZE - 24,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${GitLink}:hover &`]: {
        color: theme.color.link.primary.hover,
      },
    },
  },
});

const PanelTitle = styled("span", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
  },
});

const PanelValueLink = styled(Link, {
  base: {
    lineHeight: theme.font.lineHeight,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});

interface AutodeployDetailProps {
  routeType: "app" | "stage";
}
export function AutodeployDetail(props: AutodeployDetailProps) {
  const params = useParams();
  const workspace = useWorkspace();
  const rep = useReplicache();
  const replicacheStatus = useReplicacheStatus();
  const nav = useNavigate();
  const data = createSubscription(async (tx) => {
    const runs = (await RunStore.all(tx)).filter(
      (run) => run.id === params.runID
    );
    if (!runs.length) return;

    const run = runs[0];

    if (!run.stageID) return { run };
    const stage = await StageStore.get(tx, run.stageID);

    const update = (await StateUpdateStore.forStage(tx, run.stageID)).find(
      (update) => update.runID === run.id
    );
    return { run, stage, update };
  });

  function Header() {
    return (
      <Stack space={data.value!.update?.errors.length ? "4" : "2"}>
        <PageTitle>
          <RunStatusIcon status={data.value!.run.status} />
          <PageTitleCopy>{STATUS_MAP[data.value!.run.status]}</PageTitleCopy>
        </PageTitle>
        <Switch>
          <Match when={data.value!.update?.errors.length}>
            <Errors>
              <For each={data.value!.update?.errors}>
                {(err) => (
                  <Error>
                    <ErrorIcon>
                      <IconXCircle width={16} height={16} />
                    </ErrorIcon>
                    <Stack space="0.5">
                      <Show when={err.urn}>
                        <ErrorTitle>{getResourceName(err.urn)}</ErrorTitle>
                      </Show>
                      <ErrorMessage>{err.message.trim()}</ErrorMessage>
                    </Stack>
                  </Error>
                )}
              </For>
            </Errors>
          </Match>
          <Match when={data.value!.run.error}>
            <PageTitleMessage error={data.value!.run.status === "error"}>
              {ERROR_MAP(data.value!.run.error!)}
            </PageTitleMessage>
          </Match>
          <Match when={true}>
            <PageTitleMessage>
              {STATUS_DESC_MAP[data.value!.run.status]}
            </PageTitleMessage>
          </Match>
        </Switch>

        <Show when={data.value!.run.status === "error"}>
          <Row space="1.5" vertical="center">
            <Button
              onClick={async (e) => {
                const force =
                  e.currentTarget.parentElement!.querySelector<HTMLInputElement>(
                    "input[name='force']:checked"
                  )?.value;

                const id = createId();
                await rep().mutate.run_redeploy({
                  id,
                  runID: data.value!.run.id,
                  force: force === "true",
                });
                nav(`../${id}`);
              }}
              color="secondary"
              size="sm"
            >
              Retry deploy
            </Button>
            <ForceCheckbox
              name="force"
              type="checkbox"
              value="true"
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
            <Text>
              Force (Do not use cache and unlock the stage if locked)
            </Text>
          </Row>
        </Show>

        {/* Cancel button */}
        <Show when={["queued", "updating"].includes(data.value!.run.status)}>
          <Row space="1.5" vertical="center">
            <Button
              onClick={async (e) => {
                await rep().mutate.run_cancel({
                  runID: data.value!.run.id,
                });
              }}
              color="secondary"
              size="sm"
            >
              Cancel deploy
            </Button>
          </Row>
        </Show>
      </Stack>
    );
  }

  function Sidebar() {
    const trigger = data.value!.run.trigger;
    const repoURL = createMemo(() =>
      trigger.source === "github"
        ? githubRepo(trigger.repo.owner, trigger.repo.repo)
        : ""
    );
    const runInfo = createMemo(() => {
      const ref =
        trigger.type === "pull_request"
          ? `pr#${trigger.number}`
          : trigger.type === "tag"
            ? trigger.tag
            : trigger.type === "branch"
              ? trigger.branch
              : trigger.ref;
      const uri =
        trigger.type === "pull_request"
          ? githubPr(repoURL(), trigger.number)
          : trigger.type === "tag"
            ? githubRef(repoURL(), trigger.tag)
            : trigger.type === "branch"
              ? githubRef(repoURL(), trigger.branch)
              : githubRef(repoURL(), trigger.ref);
      const gitUser = trigger.type === "user" ? undefined : trigger.sender;

      return { trigger, ref, uri, gitUser };
    });
    const appPath = props.routeType === "app" ? "../.." : "../../..";
    return (
      <SidebarRoot>
        <Stack space="7">
          <Stack space="1.5">
            <PanelTitle>Commit</PanelTitle>
            <GitInfo>
              <Row space="1.5" vertical="center">
                <Show when={runInfo()!.gitUser}>
                  <GitAvatar title={runInfo()!.gitUser!.username}>
                    <img
                      width={AVATAR_SIZE}
                      height={AVATAR_SIZE}
                      src={`https://avatars.githubusercontent.com/u/${runInfo()!.gitUser!.id
                        }?s=${2 * AVATAR_SIZE}&v=4`}
                    />
                  </GitAvatar>
                </Show>
                <Show when={trigger.commit}>
                  <Stack space="0.5">
                    <GitLink
                      target="_blank"
                      rel="noreferrer"
                      href={githubCommit(repoURL(), trigger.commit!.id)}
                    >
                      <GitIcon size="md">
                        <IconCommit />
                      </GitIcon>
                      <GitCommit>{formatCommit(trigger.commit!.id)}</GitCommit>
                    </GitLink>
                    <GitLink
                      target="_blank"
                      rel="noreferrer"
                      href={runInfo()!.uri}
                    >
                      <GitIcon size="sm">
                        <Switch>
                          <Match when={trigger.type === "pull_request"}>
                            <IconPr />
                          </Match>
                          <Match when={trigger.type === "tag"}>
                            <IconTag />
                          </Match>
                          <Match when={true}>
                            <IconGit />
                          </Match>
                        </Switch>
                      </GitIcon>
                      <GitBranch>{runInfo()!.ref}</GitBranch>
                    </GitLink>
                  </Stack>
                </Show>
              </Row>
            </GitInfo>
          </Stack>
          <Show when={data.value!.stage}>
            <Stack space="1.5">
              <PanelTitle>Stage</PanelTitle>
              <PanelValueLink href={`${appPath}/${data.value!.stage!.name!}`}>
                {data.value!.stage!.name!}
              </PanelValueLink>
            </Stack>
          </Show>
          <Show when={data.value!.update}>
            <Stack space="1.5">
              <PanelTitle>Update</PanelTitle>
              <PanelValueLink
                href={`${appPath}/${data.value!.stage!.name!}/updates/${data.value!.update!.id
                  }`}
              >
                #{data.value!.update!.index}
              </PanelValueLink>
            </Stack>
          </Show>
          <Stack space="2">
            <PanelTitle>Started</PanelTitle>
            <Text
              color="secondary"
              title={
                data.value!.run.time.started
                  ? DateTime.fromISO(
                    data.value!.run.time.started!
                  ).toLocaleString(DateTime.DATETIME_FULL)
                  : undefined
              }
            >
              {data.value!.run.time.started
                ? formatSinceTime(
                  DateTime.fromISO(data.value!.run.time.started!).toSQL()!,
                  true
                )
                : "—"}
            </Text>
          </Stack>
          <Stack space="2">
            <PanelTitle>Duration</PanelTitle>
            <Text
              color="secondary"
              title={
                DateTime.fromISO(data.value!.run.time.completed!)
                  .diff(DateTime.fromISO(data.value!.run.time.started!))
                  .as("seconds") + " seconds"
              }
            >
              {data.value!.run.time.started && data.value!.run.time.completed
                ? formatDuration(
                  DateTime.fromISO(data.value!.run.time.completed!)
                    .diff(DateTime.fromISO(data.value!.run.time.started!))
                    .as("milliseconds"),
                  true
                )
                : "—"}
            </Text>
          </Stack>
        </Stack>
      </SidebarRoot>
    );
  }

  function Logs() {
    const workspace = useWorkspace();
    const auth = useAuth2();
    const [logs, logsAction] = createResource(
      () => data.value!.stage && data.value!.run.log,
      async (log) => {
        if (!log) return [];
        const results = await fetch(
          import.meta.env.VITE_API_URL +
          "/log/aws/scan?" +
          new URLSearchParams(
            log.engine === "lambda"
              ? {
                stageID: data.value!.stage!.id,
                timestamp: log.timestamp.toString(),
                logStream: log.logStream,
                logGroup: log.logGroup,
                requestID: log.requestID,
              }
              : {
                stageID: data.value!.stage!.id,
                logStream: log.logStream,
                logGroup: log.logGroup,
              }
          ).toString(),
          {
            headers: {
              "x-sst-workspace": workspace().id,
              Authorization: "Bearer " + auth.current.token,
            },
          }
        ).then(
          (res) =>
            res.json() as Promise<
              {
                message: string;
                timestamp: number;
              }[]
            >
        );
        return results;
      },
      {
        initialValue: [],
      }
    );
    const trimmedLogs = createMemo(() => {
      return pipe(
        logs() || [],
        dropWhile((r) => !r.message.startsWith("[sst.deploy.start]")),
        drop(1),
        filter((r) => r.message.trim() != ""),
        takeWhile((r) => !r.message.startsWith("[sst.deploy.end]"))
      );
    });

    const logsPoller = setInterval(() => {
      if (logs()?.findLast((r) => r.message.includes(" BUILD State"))) return;
      logsAction.refetch();
    }, 3000);
    onCleanup(() => clearInterval(logsPoller));

    return (
      <Stack space="2">
        <Show
          when={trimmedLogs().length}
          fallback={<PanelTitle>Logs</PanelTitle>}
        >
          <PanelTitle
            title={DateTime.fromMillis(trimmedLogs()![0].timestamp!)
              .toUTC()
              .toLocaleString(DateTime.DATETIME_FULL)}
          >
            Logs —{" "}
            {DateTime.fromMillis(trimmedLogs()![0].timestamp!).toLocaleString(
              DATETIME_NO_TIME
            )}
          </PanelTitle>
        </Show>
        <LogsBackground>
          <For each={trimmedLogs()!}>
            {(entry) => (
              <Log>
                <LogTime
                  title={DateTime.fromMillis(entry.timestamp)
                    .toUTC()
                    .toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)}
                >
                  {DateTime.fromMillis(entry.timestamp).toFormat(
                    "HH:mm:ss.SSS"
                  )}
                </LogTime>
                <LogMessage>{entry.message}</LogMessage>
              </Log>
            )}
          </For>
          <Show
            when={
              trimmedLogs()?.length && data.value!.run.status === "updating"
            }
          >
            <LogsLoading slim>
              <LogsLoadingIcon>
                <IconArrowPathSpin />
              </LogsLoadingIcon>
              <PanelEmptyCopy>Running&hellip;</PanelEmptyCopy>
            </LogsLoading>
          </Show>
          <Show when={trimmedLogs()?.length === 0}>
            <Switch>
              <Match
                when={
                  data.value!.run.status === "queued" ||
                  data.value!.run.status === "updating"
                }
              >
                <LogsLoading>
                  <LogsLoadingIcon>
                    <IconArrowPathSpin />
                  </LogsLoadingIcon>
                  <PanelEmptyCopy>Running&hellip;</PanelEmptyCopy>
                </LogsLoading>
              </Match>
              <Match when={data.value!.run.log}>
                <LogsLoading>
                  <LogsLoadingIcon>
                    <IconArrowPathSpin />
                  </LogsLoadingIcon>
                  <PanelEmptyCopy>Loading&hellip;</PanelEmptyCopy>
                </LogsLoading>
              </Match>
              <Match when={true}>
                <LogsLoading>
                  <PanelEmptyCopy>No logs available</PanelEmptyCopy>
                </LogsLoading>
              </Match>
            </Switch>
          </Show>
        </LogsBackground>
      </Stack>
    );
  }

  return (
    <Switch>
      <Match when={replicacheStatus.isSynced(rep().name) && !data.value}>
        <NotFound inset="header-tabs" />
      </Match>
      <Match when={data.value}>
        <Container>
          <Content>
            <Stack space="6">
              <Header />
              <Logs />
            </Stack>
          </Content>
          <Sidebar />
        </Container>
      </Match>
    </Switch>
  );
}

function getResourceName(urn: string) {
  return urn.split("::").at(-1);
}
