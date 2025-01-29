import { For, Show, Match, Switch, createMemo, createSignal, createEffect } from "solid-js";
import { createSubscription, useReplicache } from "@console/web/providers/replicache";
import { A, useParams } from "@solidjs/router";
import { RunStore, StateUpdateStore, StateEventStore } from "@console/web/data/app";
import { State } from "@console/core/state/index";
import { DateTime } from "luxon";
import { Dropdown } from "@console/web/ui/dropdown";
import { useStageContext } from "../context";
import { CMD_MAP, STATUS_MAP, errorCountCopy } from "./list";
import { NotFound } from "@console/web/pages/not-found";
import { inputFocusStyles } from "@console/web/ui/form";
import { styled } from "@macaron-css/solid";
import { IconPr, IconGit } from "@console/web/ui/icons/custom";
import { formatDuration, formatSinceTime } from "@console/web/common/format";
import { useReplicacheStatus } from "@console/web/providers/replicache-status";
import {
  IconTag,
  IconCheck,
  IconXCircle,
  IconEllipsisVertical,
} from "@console/web/ui/icons";
import { githubPr, githubRepo, githubRef } from "@console/web/common/url-builder";
import { sortBy } from "remeda";
import { Stack, Row } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Text } from "@console/web/ui/text";
import { usePersistentQuery, useZero } from "../../zero";
import { DiagnosticEvent, ResOpFailedEvent, ResourcePreEvent, ResOutputsEvent } from "@console/web/common/pulumi";
import { useFlags } from "@console/web/providers/flags";

const AVATAR_SIZE = 24;
const SIDEBAR_WIDTH = 300;
const RES_LEFT_BORDER = "4px";

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

export const PageStatusIcon = styled("div", {
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
      canceled: {
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

const PageTitleCopy = styled("h1", {
  base: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.medium,
  },
});

const PageTitlePrefix = styled("span", {
  base: {
    marginRight: 1,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    fontWeight: theme.font.weight.regular,
  },
});

const PageTitleStatus = styled("p", {
  base: {
    marginLeft: `calc(${theme.space[3]} + 12px)`,
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
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

const ResourceEmpty = styled("div", {
  base: {
    height: 200,
    border: `1px solid ${theme.color.divider.base}`,
    borderRadius: theme.borderRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.color.text.dimmed.base,
  },
});

const ResourceRoot = styled("div", {
  base: {
    borderRadius: theme.borderRadius,
    borderStyle: "solid",
    borderWidth: `1px 1px 1px ${RES_LEFT_BORDER}`,
    borderColor: theme.color.divider.base,
  },
  variants: {
    action: {
      created: {
        borderLeftColor: `hsla(${theme.color.blue.l2}, 100%)`,
      },
      updated: {
        borderLeftColor: `hsla(${theme.color.brand.l2}, 100%)`,
      },
      deleted: {
        borderLeftColor: `hsla(${theme.color.red.l1}, 100%)`,
      },
      same: {
        borderLeftColor: theme.color.divider.base,
      },
    },
  },
});

const ResourceChild = styled("div", {
  base: {
    ...utility.row(4),
    justifyContent: "space-between",
    padding: `${theme.space[4]} ${theme.space[4]} ${theme.space[4]} calc(${theme.space[4]} - ${RES_LEFT_BORDER} + 1px)`,
    alignItems: "center",
    borderBottom: `1px solid ${theme.color.divider.base}`,
    position: "relative",
    ":last-child": {
      borderBottom: 0,
    },
    selectors: {
      "&[data-focus='true']": {
        ...inputFocusStyles,
        outlineOffset: -1,
      },
    },
  },
});

const ResourceChildEmpty = styled("div", {
  base: {
    padding: `${theme.space[4]} ${theme.space[4]} ${theme.space[4]} calc(${theme.space[4]} - ${RES_LEFT_BORDER} + 1px)`,
    color: theme.color.text.dimmed.base,
    fontSize: theme.font.size.sm,
    lineHeight: "normal",
  },
});

const ResourceKey = styled("span", {
  base: {
    ...utility.text.line,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    lineHeight: "normal",
    minWidth: "33%",
  },
});

const ResourceValue = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
    lineHeight: "normal",
  },
});

const Sidebar = styled("div", {
  base: {
    flex: "0 0 auto",
    width: SIDEBAR_WIDTH,
  },
});

const SidebarSpacer = styled("div", {
  base: {
    height: theme.space[1.5],
  },
});

const PanelTitle = styled("span", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
  },
});

const AutodeployInfo = styled("div", {
  base: {
    ...utility.stack(0),
    gap: `calc(${theme.space[3]} - 2px)`,
  },
});

const GitInfo = styled("div", {
  base: {
    ...utility.stack(2),
    justifyContent: "center",
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

const GitBranchLink = styled(A, {
  base: {
    ...utility.row(1),
    alignItems: "center",
    color: theme.color.text.secondary.base,
  },
});

const GitIcon = styled("span", {
  base: {
    flex: "0 0 auto",
    lineHeight: 0,
    width: 14,
    height: 14,
    color: theme.color.icon.secondary,
  },
});

const GitBranch = styled("span", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    maxWidth: SIDEBAR_WIDTH - AVATAR_SIZE - 24,
  },
});

const AutodeployLinkIcon = styled("span", {
  base: {
    marginLeft: 2,
    lineHeight: 0,
    verticalAlign: -2,
    opacity: theme.iconOpacity,
  },
});

const PanelValueMono = styled("span", {
  base: {
    color: theme.color.text.secondary.base,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    fontWeight: theme.font.weight.medium,
  },
});

export function Detail() {
  const params = useParams();
  const rep = useReplicache();
  const ctx = useStageContext();
  const replicacheStatus = useReplicacheStatus();
  const update = createSubscription(
    () => (tx) => StateUpdateStore.get(tx, ctx.stage.id, params.updateID),
  );
  const resources = StateEventStore.forUpdate.watch(
    rep,
    () => [ctx.stage.id, params.updateID],
    (resources) => sortBy(resources, [(r) => getResourceName(r.urn)!, "asc"]),
  );

  const run = createSubscription(() => {
    const updateID = params.updateID;
    const stageID = ctx.stage.id;
    return async (tx) => {
      const update = await StateUpdateStore.get(tx, stageID, updateID);
      if (!update.runID) return;
      return RunStore.get(tx, update.runID);
    };
  });
  const repoURL = createMemo(() =>
    run.value?.trigger.source === "github"
      ? githubRepo(run.value.trigger.repo.owner, run.value.trigger.repo.repo)
      : "",
  );

  const status = createMemo(() => {
    if (!update.value) return;

    // Case 1: Update triggerd from Autodeploy
    if (run.value) {
      // Case 1a: completed
      if (run.value.time.completed) {
        if (!run.value.time.started) return "skipped";
        return run.value.error ? "error" : "updated";
      }
      // Case 1a: not-completed
      return run.value.active ? "updating" : "queued";
    }

    // Case 2: Update triggered from CLI
    if (update.value.time.completed)
      return update.value.errors.length ? "error" : "updated";
    return "updating";
  });
  const deleted = createMemo(() =>
    resources().filter((r) => r.action === "deleted"),
  );
  const created = createMemo(() =>
    resources().filter((r) => r.action === "created"),
  );
  const updated = createMemo(() =>
    resources().filter((r) => r.action === "updated"),
  );
  const isEmpty = createMemo(
    () =>
      update.value &&
      !deleted().length &&
      !created().length &&
      !updated().length &&
      !update.value.resource.same,
  );

  function renderSidebar() {
    const runInfo = createMemo(() => {
      if (!run.value) return;

      const trigger = run.value.trigger;
      const branch =
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

      return { trigger, branch, uri, gitUser };
    });
    return (
      <Sidebar>
        <Stack space={runInfo() ? "7" : "0"}>
          <Show when={runInfo()} fallback={<SidebarSpacer />}>
            <AutodeployInfo>
              <PanelTitle>Autodeploy</PanelTitle>
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
                  <GitBranchLink href={`../../../autodeploy/${run.value!.id}`}>
                    <GitIcon>
                      <Switch>
                        <Match
                          when={runInfo()!.trigger.type === "pull_request"}
                        >
                          <IconPr />
                        </Match>
                        <Match when={runInfo()!.trigger.type === "tag"}>
                          <IconTag />
                        </Match>
                        <Match when={true}>
                          <IconGit />
                        </Match>
                      </Switch>
                    </GitIcon>
                    <GitBranch>{runInfo()!.branch}</GitBranch>
                  </GitBranchLink>
                </Row>
              </GitInfo>
            </AutodeployInfo>
          </Show>
          <Stack space="7">
            <Stack space="2">
              <PanelTitle>Started</PanelTitle>
              <Text
                color="secondary"
                title={
                  update.value!.time.started
                    ? DateTime.fromISO(
                      update.value!.time.started!,
                    ).toLocaleString(DateTime.DATETIME_FULL)
                    : undefined
                }
              >
                {update.value!.time.started
                  ? formatSinceTime(
                    DateTime.fromISO(update.value!.time.started!).toSQL()!,
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
                  DateTime.fromISO(update.value!.time.completed!)
                    .diff(DateTime.fromISO(update.value!.time.started!))
                    .as("seconds") + " seconds"
                }
              >
                {update.value!.time.started && update.value!.time.completed
                  ? formatDuration(
                    DateTime.fromISO(update.value!.time.completed!)
                      .diff(DateTime.fromISO(update.value!.time.started!))
                      .as("milliseconds"),
                    true,
                  )
                  : "—"}
              </Text>
            </Stack>
            <Stack space="2">
              <PanelTitle>Command</PanelTitle>
              <PanelValueMono>{CMD_MAP[update.value!.command]}</PanelValueMono>
            </Stack>
          </Stack>
        </Stack>
      </Sidebar>
    );
  }

  const zero = useZero()
  const [stateEvents] = usePersistentQuery(() => zero.query.state_event.where("update_id", params.updateID).orderBy("sequence", "asc"))
  const stateEventSummary = createMemo(() => {

    const resources = {} as Record<string, {
      urn: string
      name: string
      error: {
        timestamp: number
        data: DiagnosticEvent
      }[]
      info: {
        timestamp: number
        data: DiagnosticEvent
      }[]
      pre: {
        timestamp: number
        sequence: number
        data: ResourcePreEvent
      },
      output?: {
        timestamp: number
        data: ResOutputsEvent
      }
      failed?: {
        timestamp: number
        data: ResOpFailedEvent
      }
    }>

    for (let item of stateEvents()) {
      if (item.type === "pulumi.resourcePreEvent") {
        if (["same", "read"].includes(item.data.metadata.op)) continue
        resources[item.data.metadata.urn] = {
          urn: item.data.metadata.urn,
          name: item.data.metadata.urn.split("::").at(-1),
          pre: item,
          info: [],
          error: []
        }
      }

      if (item.type === "pulumi.resOutputsEvent") {
        const resource = resources[item.data.metadata.urn]
        if (!resource) continue
        resource.output = item.data
      }

      if (item.type === "pulumi.resourceFailedEvent") {
        const resource = resources[item.data.metadata.urn]
        if (!resource) continue
        resource.failed = item.data
      }

      if (item.type === "pulumi.diagnosticEvent") {
        const resource = resources[item.data.urn]
        if (!resource) continue
        if (item.data.severity === "error") {
          resource.error.push(item)
        }
        resource.info.push(item)
      }
    }
    return Object.values(resources).toSorted((a, b) => a.pre.sequence - b.pre.sequence)
  })

  const stateEventTiming = createMemo(() => Object.fromEntries(stateEvents().filter((item) => item.type === "pulumi.resourcePreEvent").map((item) => [item.data.metadata.urn, item.timestamp])) as Record<string, number>)

  createEffect(() => {
    console.log("stateEvent", stateEventSummary())
    console.log("stateEventTiming", stateEventTiming())
  })

  const flags = useFlags()

  function renderResources() {
    return (
      <>
        <Show when={flags.zero}>
          <Stack space="2">
            <PanelTitle id="raw">Raw</PanelTitle>
            <ResourceRoot>
              <For each={stateEventSummary()}>
                {(item) => {
                  return (
                    <>
                      <ResourceChild>
                        <ResourceKey>{item.name} - {item.pre.data.metadata.op} - {formatDuration((item.output?.timestamp || item.failed?.timestamp || 0) - item.pre.timestamp)}</ResourceKey>
                        <ResourceValue>{item.pre.data.metadata.type}</ResourceValue>
                      </ResourceChild>
                      <pre>
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </>
                  )
                }}
              </For>
            </ResourceRoot>
          </Stack>
        </Show>
        <Show when={deleted().length}>
          <Stack space="2">
            <PanelTitle id="removed">Removed</PanelTitle>
            <ResourceRoot action="deleted">
              <For each={deleted()}>{(r) => <Resource {...r} />}</For>
            </ResourceRoot>
          </Stack>
        </Show>
        <Show when={created().length}>
          <Stack space="2">
            <PanelTitle id="added">Added</PanelTitle>
            <ResourceRoot action="created">
              <For each={created()}>{(r) => <Resource {...r} />}</For>
            </ResourceRoot>
          </Stack>
        </Show>
        <Show when={updated().length}>
          <Stack space="2">
            <PanelTitle id="updated">Updated</PanelTitle>
            <ResourceRoot action="updated">
              <For each={updated()}>{(r) => <Resource {...r} />}</For>
            </ResourceRoot>
          </Stack>
        </Show>
        <Show when={update.value!.resource.same! > 0}>
          <Stack space="2">
            <PanelTitle id="unchanged">Unchanged</PanelTitle>
            <ResourceRoot action="same">
              <ResourceChildEmpty>
                {countCopy(update.value!.resource.same!)} were not changed
              </ResourceChildEmpty>
            </ResourceRoot>
          </Stack>
        </Show>
      </>
    );
  }

  function renderHeader() {
    return (
      <Stack space="2.5">
        <PageTitle>
          <PageStatusIcon status={status()} />
          <PageTitleCopy>
            Update <PageTitlePrefix>#</PageTitlePrefix>
            {update.value!.index}
          </PageTitleCopy>
        </PageTitle>
        <PageTitleStatus>
          {status() === "error"
            ? errorCountCopy(update.value!.errors.length)
            : STATUS_MAP[status()!]}
        </PageTitleStatus>
      </Stack>
    );
  }

  function renderErrors() {
    return (
      <Errors>
        <For each={update.value!.errors}>
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
    );
  }

  return (
    <Switch>
      <Match when={replicacheStatus.isSynced(rep().name) && !update.value}>
        <NotFound inset="header-tabs" />
      </Match>
      <Match when={update.value}>
        <Container>
          <Content>
            <Stack space="6">
              <Stack space="4">
                {renderHeader()}
                <Show when={update.value!.errors.length}>{renderErrors()}</Show>
              </Stack>
              <Stack space="5">
                <Switch>
                  <Match when={!isEmpty()}>{renderResources()}</Match>
                  <Match
                    when={status() === "updating" || status() === "queued"}
                  >
                    <ResourceEmpty>Updating&hellip;</ResourceEmpty>
                  </Match>
                  <Match
                    when={status() !== "updating" && status() !== "queued"}
                  >
                    <ResourceEmpty>No changes</ResourceEmpty>
                  </Match>
                </Switch>
              </Stack>
            </Stack>
          </Content>
          {renderSidebar()}
        </Container>
      </Match>
    </Switch>
  );
}

function Resource(props: State.ResourceEvent) {
  const [copying, setCopying] = createSignal(false);
  const name = createMemo(() => getResourceName(props.urn));
  return (
    <ResourceChild>
      <ResourceKey>{name()}</ResourceKey>
      <Row space="3" vertical="center">
        <ResourceValue>{props.type}</ResourceValue>
        <Dropdown
          size="sm"
          disabled={copying()}
          icon={
            copying() ? (
              <IconCheck width={16} height={16} />
            ) : (
              <IconEllipsisVertical width={16} height={16} />
            )
          }
        >
          <Dropdown.Item
            onSelect={() => {
              setCopying(true);
              navigator.clipboard.writeText(props.urn);
              setTimeout(() => setCopying(false), 2000);
            }}
          >
            Copy URN
          </Dropdown.Item>
        </Dropdown>
      </Row>
    </ResourceChild>
  );
}

function countCopy(count?: number) {
  return count! > 1 ? `${count} resources` : "1 resource";
}

function getResourceName(urn: string) {
  return urn.split("::").at(-1);
}

function shortenCommit(commit: string) {
  return commit.slice(0, 7);
}
