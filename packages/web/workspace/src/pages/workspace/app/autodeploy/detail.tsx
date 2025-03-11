import { PageHeader } from "../header";
import {
  For,
  Show,
  Match,
  Switch,
  Suspense,
  onCleanup,
  createMemo,
  createResource,
} from "solid-js";
import {
  createSubscription,
  useReplicache,
} from "@console/web/providers/replicache";
import { A, useNavigate, useParams } from "@solidjs/router";
import { UserStore } from "@console/web/data/user";
import { RunStore, StateUpdateStore } from "@console/web/data/app";
import { StageStore } from "@console/web/data/stage";
import { DateTime } from "luxon";
import { ERROR_MAP, STATUS_MAP } from "./list";
import {
  LogsLoading,
  LogsBackground,
  PanelEmptyCopy,
  LogsLoadingIcon,
} from "../../stage/issues/detail";
import { NotFound } from "@console/web/pages/not-found";
import { styled } from "@macaron-css/solid";
import { globalKeyframes } from "@macaron-css/core";
import {
  IconPr,
  IconGit,
  IconCommit,
  IconArrowPathSpin,
} from "@console/web/ui/icons/custom";
import { AvatarInitialsIcon } from "@console/web/ui/avatar-icon";
import { Log, LogTime, LogMessage } from "@console/web/common/invocation";
import {
  formatCommit,
  formatDuration,
  formatSinceTime,
} from "@console/web/common/format";
import { useReplicacheStatus } from "@console/web/providers/replicache-status";
import {
  githubPr,
  githubRepo,
  githubRef,
  githubCommit,
} from "@console/web/common/url-builder";
import { pipe, dropWhile, drop, takeWhile, filter } from "remeda";
import { useWorkspace } from "../../context";
import { IconTag, IconXCircle } from "@console/web/ui/icons";
import { utility } from "@console/web/ui/utility";
import { theme } from "@console/web/ui/theme";
import { Stack, Row } from "@console/web/ui/layout";
import { Text } from "@console/web/ui/text";
import { Button } from "@console/web/ui/button";
import { createId } from "@paralleldrive/cuid2";
import { useOpenAuth } from "@openauthjs/solid"

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

const TriggerInfo = styled("div", {
  base: {
    ...utility.stack(2),
    justifyContent: "center",
    height: 44,
  },
});

const ActorAvatar = styled("div", {
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

const PanelValueLink = styled(A, {
  base: {
    lineHeight: theme.font.lineHeight,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});

export function Detail() {
  const params = useParams();
  const rep = useReplicache();
  const replicacheStatus = useReplicacheStatus();
  const nav = useNavigate();
  const data = createSubscription(() => {
    const runID = params.runID;
    return async (tx) => {
      const run = await RunStore.get(tx, runID);
      if (!run) return;
      if (!run.stageName) return { run };
      const stage = (await StageStore.list(tx)).find(
        (stage) =>
          stage.name === run.stageName &&
          stage.appID === run.appID &&
          !stage.timeDeleted,
      );
      if (!stage) return { run };
      const update = (await StateUpdateStore.forStage(tx, stage.id)).find(
        (update) => update.runID === run.id,
      );
      return { run, stage, update };
    };
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

        <Show when={false && data.value!.run.status === "error"}>
          <Row space="1.5" vertical="center">
            <Button
              onClick={async (e) => {
                const force =
                  e.currentTarget.parentElement!.querySelector<HTMLInputElement>(
                    "input[name='force']:checked",
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
            <Text>Force (Do not use cache and unlock the stage if locked)</Text>
          </Row>
        </Show>
      </Stack>
    );
  }

  function Sidebar() {
    const trigger = data.value!.run.trigger;
    const r = createSubscription(() => async (tx) => {
      const repoURL =
        trigger.source === "github"
          ? githubRepo(trigger.repo.owner, trigger.repo.repo)
          : "";
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
          ? githubPr(repoURL, trigger.number)
          : trigger.type === "tag"
            ? githubRef(repoURL, trigger.tag)
            : trigger.type === "branch"
              ? githubRef(repoURL, trigger.branch)
              : githubRef(repoURL, trigger.ref);
      const gitUser = trigger.type === "user" ? undefined : trigger.sender;

      const actor =
        trigger.type === "user" && trigger.actor.type === "user"
          ? await UserStore.get(tx, trigger.actor.properties.userID)
          : undefined;

      const retrier =
        data.value!.run.retrier && data.value!.run.retrier.type === "user"
          ? await UserStore.get(tx, data.value!.run.retrier.properties.userID)
          : undefined;

      return { repoURL, trigger, ref, uri, gitUser, actor, retrier };
    });
    const appPath = "../..";

    return (
      <>
        <SidebarRoot>
          <Show when={r.value}>
            <Suspense>
              <Stack space="7">
                <Stack space="1.5">
                  <Switch>
                    <Match when={r.value!.retrier}>
                      <PanelTitle>Redeployed</PanelTitle>
                    </Match>
                    <Match when={r.value!.actor}>
                      <PanelTitle>Deployed</PanelTitle>
                    </Match>
                    <Match when={true}>
                      <PanelTitle>Autodeployed</PanelTitle>
                    </Match>
                  </Switch>
                  <TriggerInfo>
                    <Row space="1.5" vertical="center">
                      <Switch>
                        <Match when={r.value!.actor}>
                          <ActorAvatar title={r.value!.actor!.email}>
                            <AvatarInitialsIcon
                              type="user"
                              text={r.value!.actor?.email || ""}
                              style={{
                                width: `${AVATAR_SIZE}px`,
                                height: `${AVATAR_SIZE}px`,
                              }}
                            />
                          </ActorAvatar>
                        </Match>
                        <Match when={r.value!.retrier}>
                          <ActorAvatar title={r.value!.retrier!.email}>
                            <AvatarInitialsIcon
                              type="user"
                              text={r.value!.retrier?.email || ""}
                              style={{
                                width: `${AVATAR_SIZE}px`,
                                height: `${AVATAR_SIZE}px`,
                              }}
                            />
                          </ActorAvatar>
                        </Match>
                        <Match when={true}>
                          <ActorAvatar title={r.value!.gitUser!.username}>
                            <img
                              width={AVATAR_SIZE}
                              height={AVATAR_SIZE}
                              src={`https://avatars.githubusercontent.com/u/${r.value!.gitUser!.id
                                }?s=${2 * AVATAR_SIZE}&v=4`}
                            />
                          </ActorAvatar>
                        </Match>
                      </Switch>
                      <Show when={r.value!.trigger.commit}>
                        <Stack space="0.5">
                          <GitLink
                            target="_blank"
                            rel="noreferrer"
                            href={githubCommit(
                              r.value!.repoURL,
                              trigger.commit!.id,
                            )}
                          >
                            <GitIcon size="md">
                              <IconCommit />
                            </GitIcon>
                            <GitCommit>
                              {formatCommit(trigger.commit!.id)}
                            </GitCommit>
                          </GitLink>
                          <GitLink
                            target="_blank"
                            rel="noreferrer"
                            href={r.value!.uri}
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
                            <GitBranch>{r.value!.ref}</GitBranch>
                          </GitLink>
                        </Stack>
                      </Show>
                    </Row>
                  </TriggerInfo>
                </Stack>
                <Show when={data.value!.stage}>
                  <Stack space="1.5">
                    <PanelTitle>Stage</PanelTitle>
                    <PanelValueLink
                      href={`${appPath}/${data.value!.stage!.name!}`}
                    >
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
                      data.value!.run.time.created
                        ? DateTime.fromISO(
                          data.value!.run.time.created!,
                        ).toLocaleString(DateTime.DATETIME_FULL)
                        : undefined
                    }
                  >
                    {data.value!.run.time.created
                      ? formatSinceTime(
                        DateTime.fromISO(
                          data.value!.run.time.created!,
                        ).toSQL()!,
                        true,
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
                    {data.value!.run.time.started &&
                      data.value!.run.time.completed
                      ? formatDuration(
                        DateTime.fromISO(data.value!.run.time.completed!)
                          .diff(
                            DateTime.fromISO(data.value!.run.time.started!),
                          )
                          .as("milliseconds"),
                        true,
                      )
                      : "—"}
                  </Text>
                </Stack>
              </Stack>
            </Suspense>
          </Show>
        </SidebarRoot>
      </>
    );
  }

  function Logs() {
    const workspace = useWorkspace();
    const auth = useOpenAuth()
    const [logs, logsAction] = createResource(
      () => {
        if (data.value?.run.log) return data.value.run.log;
        return true;
      },
      async (log) => {
        console.log("here", log);
        // stupid hack to detect if logs should be cleared
        if (log === true || log === false) return [];
        const results = await fetch(
          import.meta.env.VITE_API_URL +
          "/log/aws/scan?" +
          new URLSearchParams({
            awsAccountExternalID: data.value!.run.awsAccountExternalID!,
            region: data.value!.run.region!,
            logStream: log.logStream,
            logGroup: log.logGroup,
          }).toString(),
          {
            headers: {
              "x-sst-workspace": workspace().id,
              Authorization: "Bearer " + await auth.access(),
            },
          },
        ).then(
          (res) =>
            res.json() as Promise<
              {
                message: string;
                timestamp: number;
              }[]
            >,
        );
        return results;
      },
      {
        initialValue: [],
      },
    );
    const trimmedLogs = createMemo(() => {
      return pipe(
        logs() || [],
        dropWhile((r) => !r.message.startsWith("[sst.deploy.start]")),
        drop(1),
        filter((r) => r.message.trim() != ""),
        takeWhile((r) => !r.message.startsWith("[sst.deploy.end]")),
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
              DATETIME_NO_TIME,
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
                    "HH:mm:ss.SSS",
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
              <Match when={data.value!.run.time.started}>
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
    <>
      <PageHeader />
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
    </>
  );
}

function getResourceName(urn: string) {
  return urn.split("::").at(-1);
}
