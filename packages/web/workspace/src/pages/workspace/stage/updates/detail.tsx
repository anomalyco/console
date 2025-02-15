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
import { IconPr, IconGit, IconCaretRight } from "@console/web/ui/icons/custom";
import { formatDuration, formatSinceTime } from "@console/web/common/format";
import { useReplicacheStatus } from "@console/web/providers/replicache-status";
import { LogsBackground } from "../issues/detail";
import { Log, LogTime, LogMessage } from "@console/web/common/invocation";
import {
  IconTag,
  IconCheck,
  IconXCircle,
  IconEllipsisVertical,
  IconDocumentDuplicate,
} from "@console/web/ui/icons";
import { githubPr, githubRepo, githubRef } from "@console/web/common/url-builder";
import { sortBy } from "remeda";
import { Stack, Row } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Text } from "@console/web/ui/text";
import { usePersistentQuery, useZero } from "../../zero";
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
    position: "relative",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[3]}`,
    height: 50,
    gap: theme.space[6],
  },
});

const HeaderTitle = styled("span", {
  base: {
    ...utility.text.line,
    minWidth: 0,
    color: theme.color.text.primary.surface,
    fontWeight: theme.font.weight.medium,
    lineHeight: "normal",
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
    padding: `0 ${theme.space[3]}`,
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
    padding: `${theme.space[4]} 0`,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space[4],
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

const ChildKey = styled("span", {
  base: {
    ...utility.text.line,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.primary.surface,
    lineHeight: "normal",
    minWidth: "33%",
  },
  variants: {
    outline: {
      true: {
        color: theme.color.text.primary.base,
      },
    },
  },
});

const ChildValueMono = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.dimmed.surface,
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

const ChildIconButton = styled("button", {
  base: {
    flexShrink: 0,
    height: 16,
    width: 16,
    color: theme.color.icon.dimmed,
    ":hover": {
      color: theme.color.icon.secondary,
    },
  },
  variants: {
    size: {
      sm: {
        height: 16,
        width: 16,
      },
      xs: {
        height: 14,
        width: 14,
      },
    },
    copying: {
      true: {
        cursor: "default",
        color: theme.color.icon.dimmed,
        ":hover": {
          color: theme.color.icon.dimmed,
        },
      },
    },
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

const EventRoot = styled("div", {
  base: {},
});

const EventResource = styled("div", {
  base: {
    borderStyle: "solid",
    borderWidth: `0 1px 0 ${RES_LEFT_BORDER}`,
    borderColor: theme.color.divider.base,
    selectors: {
      [`${EventRoot}:first-child &`]: {
        borderTopWidth: 1,
        borderTopLeftRadius: theme.borderRadius,
        borderTopRightRadius: theme.borderRadius,
      },
      [`${EventRoot}:last-child &`]: {
        borderBottomWidth: 1,
        borderBottomLeftRadius: theme.borderRadius,
        borderBottomRightRadius: theme.borderRadius,
      },
      [`${EventRoot}[data-expanded="true"]:last-child &`]: {
        borderBottomWidth: 1,
        borderRadius: 0,
      },
    },
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

const EventResourceContent = styled("div", {
  base: {
    ...utility.row(2),
    justifyContent: "space-between",
    borderWidth: "1px 0 0",
    borderStyle: "solid",
    borderColor: theme.color.divider.base,
    padding: `${theme.space[4]} ${theme.space[3]} ${theme.space[4]} calc(${theme.space[3]} - 3px)`,
    alignItems: "center",
    selectors: {
      [`${EventRoot}:first-child &`]: {
        borderTopWidth: 0,
      },
    },
  },
});

const EventResourceEmpty = styled("div", {
  base: {
    paddingLeft: 4,
    color: theme.color.text.dimmed.base,
    fontSize: theme.font.size.sm,
    lineHeight: "normal",
  },
});

const CaretIcon = styled("button", {
  base: {
    width: 20,
    height: 20,
    flexShrink: 0,
    lineHeight: 0,
    color: theme.color.icon.dimmed,
  },
  variants: {
    expanded: {
      true: {
        transform: "rotate(90deg)",
      },
    },
  },
});

const EventTime = styled("div", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
    flexShrink: 0,
    minWidth: 72,
  },
});

const EventResourceName = styled("span", {
  base: {
    ...utility.text.line,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    lineHeight: "normal",
    width: 300,
  },
});

const EventResourceType = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
    lineHeight: "normal",
  },
});

const EventDuration = styled("div", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    flexShrink: 0,
    minWidth: 70,
    textAlign: "right",
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
  },
});

const EventDetail = styled("div", {
  base: {
    ...utility.stack(5),
    borderWidth: "1px 1px 0",
    borderStyle: "solid",
    borderColor: theme.color.divider.base,
    padding: theme.space[4],
    selectors: {
      [`${EventRoot}:last-child &`]: {
        borderTopWidth: 0,
        borderBottomWidth: 1,
        borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
      },
    },
  },
});

const EventError = styled("div", {
  base: {
    ...utility.row(2),
    color: `hsla(${theme.color.red.l2}, 100%)`,
    padding: theme.space[4],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.red,
  },
});

const EventInputDiffRow = styled("div", {
  base: {
    borderWidth: `0 1px 0 3px`,
    borderStyle: "solid",
    borderColor: theme.color.divider.base,
    ":first-child": {
      borderRadius: `${theme.borderRadius} ${theme.borderRadius} 0 0`,
      borderTopWidth: 1,
    },
    ":last-child": {
      borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
      borderBottomWidth: 1,
    },
  },
  variants: {
    color: {
      green: {
        borderLeftColor: `hsla(${theme.color.blue.l2}, 100%)`,
      },
      red: {
        borderLeftColor: `hsla(${theme.color.red.l1}, 100%)`,
      },
      grey: {
        borderLeftColor: theme.color.divider.base,
      },
    },
  },
});

const EventInputDiffContent = styled("div", {
  base: {
    padding: `${theme.space[2.5]} ${theme.space[2]}`,
    borderBottom: `1px solid ${theme.color.divider.base}`,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space[4],
    selectors: {
      [`${EventInputDiffRow}:last-child &`]: {
        borderBottom: "none",
      },
    },
  },
});

const EventInputKey = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.mono_sm,
    lineHeight: "normal",
    minWidth: "33%",
    fontFamily: theme.font.family.code,
  },
});

const EventInputValue = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.mono_xs,
    fontFamily: theme.font.family.code,
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

const PanelValueRow = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
  },
});

const PanelValueCopy = styled("button", {
  base: {
    flexShrink: 0,
    height: 16,
    width: 16,
    color: theme.color.icon.dimmed,
    ":hover": {
      color: theme.color.icon.secondary,
    },
  },
  variants: {
    copying: {
      true: {
        cursor: "default",
        color: theme.color.icon.dimmed,
        ":hover": {
          color: theme.color.icon.dimmed,
        },
      },
    },
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
    const [copying, setCopying] = createSignal(false);
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
            <Show when={flags.zero}>
              <Stack space="2">
                <PanelTitle>Permalink</PanelTitle>
                <PanelValueRow>
                  <PanelValueMono>
                    sst.dev/u/9a6c7a
                  </PanelValueMono>
                  <PanelValueCopy
                    copying={copying()}
                    onClick={() => {
                      setCopying(true);
                      navigator.clipboard.writeText("https://sst.dev/u/9a6c7a");
                      setTimeout(() => setCopying(false), 2000);
                    }}
                  >
                    <Show when={!copying()} fallback={<IconCheck />}>
                      <IconDocumentDuplicate />
                    </Show>
                  </PanelValueCopy>
                </PanelValueRow>
              </Stack>
            </Show>
          </Stack>
        </Stack>
      </Sidebar>
    );
  }

  const zero = useZero()
  const [stateEvents] = usePersistentQuery(() => zero.query.state_event.where("update_id", "=", params.updateID).orderBy("time_completed", "asc"))

  createEffect(() => {
    console.log("stateEvent", stateEvents())
  })

  const flags = useFlags()

  function renderResources() {
    return (
      <>
        <Show when={flags.zero}>
          <Stack space="2">
            <PanelTitle id="raw">Feb 12, 2025</PanelTitle>
            <div>
              <For each={stateEvents()}>
                {(item) => {
                  const [expanded, setExpanded] = createSignal(false);
                  const duration = createMemo(() => item.time_completed - item.time_started);

                  function onClick() {
                    setExpanded(!expanded());
                  }

                  function renderCopyButton(value: any) {
                    const [copying, setCopying] = createSignal(false);
                    return (
                      <ChildIconButton size="xs" copying={copying()} onClick={() => {
                        setCopying(true);
                        navigator.clipboard.writeText(value);
                        setTimeout(() => setCopying(false), 2000);
                      }}>
                        <Show when={!copying()} fallback={<IconCheck />}>
                          <IconDocumentDuplicate />
                        </Show>
                      </ChildIconButton>
                    );
                  }

                  function renderInput(key: string, to?: any, from?: any) {
                    const toString = createMemo(() => typeof to === "string"
                      ? to
                      : JSON.stringify(to)
                    );
                    const fromString = createMemo(() => typeof from === "string"
                      ? from
                      : JSON.stringify(from)
                    );

                    return (
                      <>
                        <Show when={from}>
                          <EventInputDiffRow color="red">
                            <EventInputDiffContent>
                              <EventInputKey>{key}</EventInputKey>
                              <Row space="3" vertical="center">
                                <EventInputValue>{fromString()}</EventInputValue>
                                <Show when={fromString() !== ""}>
                                  {renderCopyButton(fromString())}
                                </Show>
                              </Row>
                            </EventInputDiffContent>
                          </EventInputDiffRow>
                        </Show>
                        <Show when={to}>
                          <EventInputDiffRow
                            color={from === undefined || from === null
                              ? "grey"
                              : "green"
                            }
                          >
                            <EventInputDiffContent>
                              <EventInputKey>{key}</EventInputKey>
                              <Row space="3" vertical="center">
                                <EventInputValue>{toString()}</EventInputValue>
                                <Show when={toString() !== ""}>
                                  {renderCopyButton(toString())}
                                </Show>
                              </Row>
                            </EventInputDiffContent>
                          </EventInputDiffRow>
                        </Show>
                      </>
                    );
                  }

                  function renderEventError(message: string) {
                    return (
                      <EventError>
                        <ErrorIcon>
                          <IconXCircle width={16} height={16} />
                        </ErrorIcon>
                        <ErrorMessage>{message}</ErrorMessage>
                      </EventError>
                    );
                  }

                  function renderEventLogs() {
                    return (
                      <Stack space="2">
                        <PanelTitle>Logs</PanelTitle>
                        <LogsBackground>
                          <For each={item.logs || []}>
                            {(log) => (
                              <Log>
                                <LogTime
                                  title={DateTime.fromMillis(log.timestamp || 0)
                                    .toUTC()
                                    .toLocaleString(
                                      DateTime.DATETIME_FULL_WITH_SECONDS,
                                    )}
                                >
                                  {DateTime.fromMillis(log.timestamp || 0).toFormat(
                                    "HH:mm:ss",
                                  )}
                                </LogTime>
                                <LogMessage>{log.message}</LogMessage>
                              </Log>
                            )}
                          </For>
                        </LogsBackground>
                      </Stack>
                    );
                  }

                  return (
                    <EventRoot data-expanded={expanded()}>
                      <EventResource action={item.action} onClick={onClick}>
                        <EventResourceContent>
                          <Row space="2" vertical="center">
                            <CaretIcon expanded={expanded()}>
                              <IconCaretRight />
                            </CaretIcon>
                            <EventTime
                              title={DateTime.fromMillis(item.time_completed || 0)
                                .toUTC()
                                .toLocaleString(
                                  DateTime.DATETIME_FULL_WITH_SECONDS,
                                )}
                            >
                              {DateTime.fromMillis(item.time_completed || 0).toFormat(
                                "HH:mm:ss",
                              )}
                            </EventTime>
                            <EventResourceName>{item.urn.split("::").at(-1)}</EventResourceName>
                            <EventResourceType>{item.type}</EventResourceType>
                          </Row>
                          <Show when={true}>
                            <EventDuration>{formatDuration(duration())}</EventDuration>
                          </Show>
                        </EventResourceContent>
                      </EventResource>
                      <Show when={expanded()}>
                        <EventDetail>
                          {item.error && renderEventError(item.error)}
                          <Show when={Object.keys(item.inputs).length}>
                            <Stack space="2">
                              <PanelTitle>Inputs</PanelTitle>
                              <div>
                                <For each={
                                  Object.entries(item.inputs || {})
                                }>
                                  {([key, value]) => (
                                    renderInput(key, value.to, value.from)
                                  )}
                                </For>
                              </div>
                            </Stack>
                          </Show>
                          <Show when={Object.keys(item.outputs).length}>
                            <Stack space="2">
                              <PanelTitle>Outputs</PanelTitle>
                              <div>
                                <For each={
                                  Object.entries(item.outputs || {})
                                }>
                                  {([key, value]) => (
                                    renderInput(key, value.to, value.from)
                                  )}
                                </For>
                              </div>
                            </Stack>
                          </Show>
                          {item.logs.length && renderEventLogs()}
                        </EventDetail>
                      </Show>
                    </EventRoot>
                  );
                }}
              </For>
              <Show when={update.value!.resource.same! > 0}>
                <EventRoot>
                  <EventResource action="same">
                    <EventResourceContent>
                      <EventResourceEmpty>
                        {countCopy(update.value!.resource.same!)} were not changed
                      </EventResourceEmpty>
                    </EventResourceContent>
                  </EventResource>
                </EventRoot>
              </Show>
            </div>
          </Stack>
        </Show>
        <Show when={!flags.zero}>
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

  function renderStateOutputs() {
    const outputs = [{ key: "Api", value: "https://g3kgrm5dqskfbbhw6hkruasqyq0lbwff.lambda-url.us-east-1.on.aws/" }, { key: "ApiRouter", value: "https://api.dev.console.sst.dev" }, { key: "Error", value: "https://i3pnw4kczeu2vjtgdkicujzxyy0bgzxc.lambda-url.us-east-1.on.aws/" }, { key: "OpenAuth", value: "https://openauth.dev.console.sst.dev" }, { key: "Workspace", value: "https://dev.console.sst.dev" }, { key: "Zero", value: "https://zero.dev.console.sst.dev/" }, { key: "ZeroReplication", value: "http://internal-dev-ZeroReplicationLoadB-716793618.us-east-1.elb.amazonaws.com" }];

    return (
      <Show when={outputs.length}>
        <Card>
          <HeaderRoot>
            <HeaderTitle>Outputs</HeaderTitle>
          </HeaderRoot>
          <Children>
            <For each={outputs}>
              {(output) => {
                const [copying, setCopying] = createSignal(false);
                return (
                  <Show
                    when={
                      output.value &&
                      typeof output.value === "string" &&
                      output.value.trim() !== ""
                    }
                  >
                    <Child>
                      <ChildKey>{output.key}</ChildKey>
                      <Row space="3" vertical="center">
                        <ChildValueMono>{output.value}</ChildValueMono>
                        <ChildIconButton
                          copying={copying()}
                          onClick={() => {
                            setCopying(true);
                            navigator.clipboard.writeText(output.value!);
                            setTimeout(() => setCopying(false), 2000);
                          }}
                        >
                          <Show when={!copying()} fallback={<IconCheck />}>
                            <IconDocumentDuplicate />
                          </Show>
                        </ChildIconButton>
                      </Row>
                    </Child>
                  </Show>
                );
              }}
            </For>
          </Children>
        </Card>
      </Show>
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
                <Show when={flags.zero}>
                  {renderStateOutputs()}
                </Show>
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
