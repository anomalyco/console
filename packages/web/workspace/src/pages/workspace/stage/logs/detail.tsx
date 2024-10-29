import { useReplicache } from "$/providers/replicache";
import { Dropdown } from "$/ui/dropdown";
import {
  IconBolt,
  IconClock,
  IconCheck,
  IconCalendar,
  IconArrowDown,
  IconBoltSolid,
  IconArrowsUpDown,
  IconChevronUpDown,
  IconMagnifyingGlass,
  IconEllipsisVertical,
  IconEllipsisHorizontal,
  IconArrowPathRoundedSquare,
} from "$/ui/icons";
import { IconAws, IconArrowPathSpin } from "$/ui/icons/custom";
import { Row, Stack, Fullscreen } from "$/ui/layout";
import { TextButton, IconButton } from "$/ui/button";
import { Text } from "$/ui/text";
import { Warning } from "../";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { globalKeyframes, style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { Link, useParams, useSearchParams } from "@solidjs/router";
import { For, Match, Show, Switch, createEffect, createMemo } from "solid-js";
import {
  useResourcesContext,
  useStageContext,
  useStateResources,
} from "../context";
import type { Resource } from "@console/core/app/resource";
import { useCommandBar } from "../../command-bar";
import { DATETIME_LONG, parseTime } from "$/common/format";
import { createStore, unwrap } from "solid-js/store";
import { Invoke, InvokeControl } from "./invoke";
import { createId } from "@paralleldrive/cuid2";
import { LogSearchStore } from "$/data/log-search";
import { DialogRange, DialogRangeControl } from "./dialog-range";
import { InvocationRow } from "$/common/invocation";
import { useLocalLogs } from "$/providers/invocation";
import { DateTime } from "luxon";
import { useWorkspace } from "../../context";
import { useDummy } from "$/providers/dummy";
import { createScan } from "$/data/store";
import type { Invocation } from "@console/core/log";
import { sortBy } from "remeda";
import { getLogInfo } from "../issues/common";
import {
  KeyboardNavigator,
  createKeyboardNavigator,
} from "$/common/keyboard-navigator";
import { profileID } from "$/providers/realtime";
import { Tag } from "$/ui/tag";

const LogSwitchButton = styled("button", {
  base: {
    ...utility.row(1),
    alignItems: "center",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.secondary.base,
  },
});

const LogSwitchIcon = styled("div", {
  base: {
    width: 18,
    height: 18,
    opacity: theme.iconOpacity,
  },
});

export const LogList = styled("div", {
  base: {},
});

export const LogLoadingIndicator = styled("div", {
  base: {
    ...utility.row(0),
    height: 52,
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${theme.space[3]} 0 ${theme.space[3]}`,
    borderStyle: "solid",
    borderWidth: `1px 1px 1px 1px`,
    borderColor: theme.color.divider.base,
    backgroundColor: theme.color.background.surface,
    borderRadius: `${theme.borderRadius} ${theme.borderRadius} 0 0`,
    ":last-child": {
      borderRadius: theme.borderRadius,
    },
  },
});

export const LogLoadingIndicatorCopy = styled("span", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

export const LogLoadingIndicatorIcon = styled("div", {
  base: {
    padding: 2,
    width: 20,
    height: 20,
    opacity: theme.iconOpacity,
  },
  variants: {
    pulse: {
      true: {},
      false: {},
    },
    glow: {
      true: {
        color: theme.color.accent,
      },
      false: {
        color: theme.color.icon.secondary,
      },
    },
  },
  defaultVariants: {
    pulse: true,
    glow: false,
  },
});

export const LogLoadingIndicatorIconSvg = style({
  selectors: {
    [`${LogLoadingIndicatorIcon.selector({ pulse: true })} &`]: {
      animation: "glow-pulse 1.7s linear infinite alternate",
    },
  },
});

globalKeyframes("glow-pulse", {
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

const LogEmpty = styled("div", {
  base: {
    ...utility.stack(4),
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
  },
});

const LogMoreIndicator = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: `${theme.space[3]} ${theme.space[3]}`,
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
  },
});

const LogMoreIndicatorIcon = styled("div", {
  base: {
    padding: 2,
    width: 20,
    height: 20,
    color: theme.color.text.dimmed.base,
    opacity: theme.iconOpacity,
  },
});

const LogMoreIndicatorCopy = styled("span", {
  base: {
    lineHeight: "normal",
    color: theme.color.text.dimmed.base,
    fontSize: theme.font.size.sm,
  },
});

const InvocationsList = styled("div", {});

const [pollerCache, setPollerCache] = createStore<{ [key: string]: number }>(
  {},
);

export function Detail() {
  const stage = useStageContext();
  const invocationsContext = useLocalLogs();
  const bar = useCommandBar();
  const [id, setID] = createStore<{
    search: string;
    poller: string;
  }>({
    search: createId(),
    poller: createId(),
  });

  const params = useParams();
  const [query, setQuery] = useSearchParams<{
    dummy?: string;
    end?: string;
    logGroup?: string;
    view: string;
  }>();
  const resources = useResourcesContext();
  const resource = createMemo(
    () =>
      resources().find((x) => x.id === params.resourceID) as
        | Resource.InfoByType<"Function">
        | undefined,
  );

  const stateResources = useStateResources();
  const stateResource = createMemo(() =>
    stateResources().find((x) => x.id === params.resourceID),
  );

  const logGroup = createMemo(() => {
    if (query.logGroup) return query.logGroup;
    const r = resource();
    if (!r) return "";
    const logGroup = (() => {
      if (r.type === "Function") {
        return `/aws/lambda/${r.metadata.arn.split(":").pop()}`;
      }
      return "";
    })();
    return logGroup;
  });

  bar.register("logs", async () => {
    if (mode() === "live") return [];
    return [
      {
        title: "Live logs",
        category: "logs",
        disabled: query.view === "tail",
        run: (bar) => {
          setQuery(
            {
              view: "tail",
              end: undefined,
            },
            { replace: true },
          );
          bar.hide();
        },
        icon: IconBolt,
      },
      {
        title: "Past logs",
        category: "logs",
        disabled: query.view === "recent",
        run: (bar) => {
          setQuery(
            {
              view: "recent",
              end: undefined,
            },
            { replace: true },
          );
          bar.hide();
        },
        icon: IconClock,
      },
      {
        title: "Jump to...",
        category: "logs",
        run: (bar) => {
          rangeControl.show();
          bar.hide();
        },
        icon: IconCalendar,
      },
      {
        title: "Open in CloudWatch",
        category: "logs",
        disabled: true,
        run: () => {
          const url = `https://${
            stage.stage.region
          }.console.aws.amazon.com/cloudwatch/home?region=${
            stage.stage.region
          }#logsV2:log-groups/log-group/${logGroup().replace(/\//g, "$252F")}`;
          window.open(url, "_blank");
          bar.hide();
        },
        icon: IconAws,
      },
    ];
  });

  const mode = createMemo(() => {
    if (resource()?.enrichment.live) return "live";
    if (
      stateResource()?.outputs?.environment?.variables?.SST_FUNCTION_ID ||
      stateResource()?.outputs?._live
    )
      return "live";
    if (query.view === "tail") return "tail";
    return "search";
  });

  createEffect(() => {
    if (!query.view)
      setQuery(
        {
          view: "recent",
        },
        { replace: true },
      );
  });

  createEffect(() => console.log("mode", stateResource()?.outputs));

  const workspace = useWorkspace();
  createEffect(() => {
    const m = mode();
    const lg = logGroup();
    const view = query.view;
    const end = query.end;
    if (m === "live") return;
    if (!lg) return;
    console.log(
      view,
      `https://${
        stage.stage.region
      }.console.aws.amazon.com/cloudwatch/home?region=${
        stage.stage.region
      }#logsV2:log-groups/log-group/${logGroup().replace(/\//g, "$252F")}`,
    );

    if (view === "recent") {
      setID("search", createId());
      createSearch();
    }

    if (view === "custom" && end) {
      setID("search", createId());
      createSearch(new Date(end).getTime());
    }

    if (view === "tail") {
      const exists = pollerCache[logGroup()];
      if (exists) return;
      async function run() {
        await fetch(import.meta.env.VITE_API_URL + "/rest/log/tail", {
          method: "POST",
          body: JSON.stringify({
            stageID: stage.stage.id,
            logGroup: logGroup(),
            profileID: profileID,
          }),
          headers: {
            "x-sst-workspace": workspace().id,
            Authorization: rep().auth,
          },
        });
        setTimeout(run, 3000);
      }
      setPollerCache(logGroup(), Date.now());
      run();
    }
  });

  const rep = useReplicache();

  const activeSearch = LogSearchStore.get.watch(rep, () => [id.search]);

  async function createSearch(end?: number) {
    if (dummy()) return;
    rep().mutate.log_search({
      id: id.search,
      profileID: profileID,
      stageID: stage.stage.id,
      logGroup: logGroup(),
      timeStart: null,
      timeEnd: end
        ? DateTime.fromMillis(end).toUTC().toSQL({ includeOffset: false })!
        : null,
    });
  }

  const logGroupKey = createMemo(() => {
    const base = logGroup();
    const searchID = id.search;
    const addr = resource()?.addr!;
    const urn =
      stateResource()?.type === "sst:aws:Function"
        ? stateResource()?.urn!
        : stateResource()?.parent!;
    if (mode() === "live") return addr || urn;
    if (mode() === "search") return searchID;
    return base + "-tail";
  });

  const dummy = useDummy();
  const dummyInvocations = createScan<Invocation>(
    () => "/invocation",
    rep,
    (all) => sortBy(all, (x) => x.start),
  );

  const invocations = createMemo(() => {
    if (import.meta.env.DEV) {
      if (dummy()) return dummyInvocations();
    }
    console.log("invocation source", logGroupKey());
    const result = invocationsContext.forSource(logGroupKey()) || [];
    if (mode() === "tail" || mode() === "live") return result.slice().reverse();
    return result;
  });

  let invokeControl!: InvokeControl;
  let rangeControl!: DialogRangeControl;

  const title = createMemo(() =>
    stateResource()
      ? stateResource()?.urn.split("::").at(-1)
      : query.logGroup
        ? getLogInfo(resources(), query.logGroup)?.name
        : resource()?.metadata.handler,
  );

  const navigator = createKeyboardNavigator({
    target: "[data-element='invocation']",
    onSelect: (el) => (el.firstElementChild as HTMLElement).click(),
    onPeek: (el, event) => {
      if (event === "open" && !el.dataset.expanded) {
        (el.firstElementChild as HTMLElement).click();
      }

      if (event === "close" && el.dataset.expanded) {
        (el.firstElementChild as HTMLElement).click();
      }
    },
  });

  return (
    <Switch>
      <Match
        when={
          workspace().timeGated != null && !stage.connected && !stage.isFree
        }
      >
        <Fullscreen inset="header-tabs">
          <Warning
            title="Update billing details"
            description={
              <>
                Your usage is above the free tier,{" "}
                <Link href={`/${workspace().slug}/settings#billing`}>
                  update your billing details
                </Link>
                .<br />
                Note, you can continue using the Console for local stages.
                <br />
                Just make sure `sst dev` is running locally.
              </>
            }
          />
        </Fullscreen>
      </Match>
      <Match when={true}>
        <>
          <Stack space="5" style={{ padding: `${theme.space[4]}` }}>
            <Row space="2" horizontal="between" vertical="center">
              <Stack space="2" vertical="center">
                <Text size="lg" weight="medium">
                  Logs
                </Text>
                <LogSwitchButton onClick={() => bar.show("resource")}>
                  <span>{title()}</span>
                  <LogSwitchIcon>
                    <IconChevronUpDown />
                  </LogSwitchIcon>
                </LogSwitchButton>
              </Stack>
              <Show when={mode() === "live"}>
                <Tag level="tip" style="outline">
                  Local
                </Tag>
              </Show>
            </Row>
            <LogList>
              <LogLoadingIndicator>
                <Row space="2" vertical="center">
                  <LogLoadingIndicatorIcon
                    pulse={mode() !== "search"}
                    glow={
                      (mode() === "live" && stage.connected) ||
                      mode() === "tail"
                    }
                  >
                    <Switch>
                      <Match when={mode() === "live" && !stage.connected}>
                        <IconArrowsUpDown />
                      </Match>
                      <Match when={mode() === "search"}>
                        <IconArrowDown />
                      </Match>
                      <Match when={true}>
                        <IconBoltSolid class={LogLoadingIndicatorIconSvg} />
                      </Match>
                    </Switch>
                  </LogLoadingIndicatorIcon>
                  <LogLoadingIndicatorCopy>
                    <Switch>
                      <Match when={mode() === "live" && !stage.connected}>
                        Trying to connect to local `sst dev`
                      </Match>
                      <Match when={mode() === "live"}>
                        Tailing logs from local `sst dev`
                      </Match>
                      <Match when={mode() === "search"}>
                        <Show when={query.end} fallback="Viewing past logs">
                          <span>
                            Viewing logs older than{" "}
                            {DateTime.fromISO(query.end!).toLocaleString(
                              DATETIME_LONG,
                            )}
                          </span>
                        </Show>
                      </Match>
                      <Match when={true}>
                        <Show
                          when={pollerCache[logGroup()]}
                          fallback="Starting tailer"
                        >
                          Tailing logs since{" "}
                          {DateTime.fromMillis(
                            Math.min(
                              invocations().at(-1)?.start || Number.MAX_VALUE,
                              pollerCache[logGroup()],
                            ),
                          ).toLocaleString(DATETIME_LONG)}
                        </Show>
                      </Match>
                    </Switch>
                  </LogLoadingIndicatorCopy>
                </Row>
                <Row space="3.5" vertical="center">
                  <Show when={mode() !== "search" && invocations().length > 0}>
                    <TextButton
                      onClick={() => {
                        invocationsContext.clear(logGroupKey());
                        setPollerCache(logGroup(), Date.now());
                      }}
                    >
                      Clear
                    </TextButton>
                  </Show>
                  <Show when={mode() === "search" && activeSearch()?.outcome}>
                    <IconButton
                      title="Reload logs"
                      onClick={() => {
                        invocationsContext.clear(logGroupKey());
                        createSearch(
                          query.end ? new Date(query.end).getTime() : undefined,
                        );
                      }}
                    >
                      <IconArrowPathRoundedSquare
                        display="block"
                        width={20}
                        height={20}
                      />
                    </IconButton>
                  </Show>
                  <Show when={mode() !== "live"}>
                    <Dropdown size="sm" label="View">
                      <Dropdown.RadioGroup
                        value={query.view}
                        onChange={(val) => {
                          if (val === "custom") return;
                          setQuery(
                            {
                              view: val,
                              end: undefined,
                            },
                            {
                              replace: true,
                            },
                          );
                        }}
                      >
                        <Dropdown.RadioItem closeOnSelect value="tail">
                          <Dropdown.RadioItemLabel>
                            Live
                          </Dropdown.RadioItemLabel>
                          <Dropdown.ItemIndicator>
                            <IconCheck width={14} height={14} />
                          </Dropdown.ItemIndicator>
                        </Dropdown.RadioItem>
                        <Dropdown.RadioItem closeOnSelect value="recent">
                          <Dropdown.RadioItemLabel>
                            Past
                          </Dropdown.RadioItemLabel>
                          <Dropdown.ItemIndicator>
                            <IconCheck width={14} height={14} />
                          </Dropdown.ItemIndicator>
                        </Dropdown.RadioItem>
                        <Dropdown.RadioItem
                          onSelect={() => {
                            setTimeout(() => rangeControl.show(), 0);
                            return;
                          }}
                          closeOnSelect
                          value="custom"
                        >
                          Jump to&hellip;
                        </Dropdown.RadioItem>
                      </Dropdown.RadioGroup>
                    </Dropdown>
                  </Show>
                </Row>
              </LogLoadingIndicator>
              <Show
                when={
                  (mode() === "tail" ||
                    mode() === "live" ||
                    mode() === "search" ||
                    query.view === "recent") &&
                  (resource() || stateResource())
                }
              >
                <Invoke
                  control={(c) => (invokeControl = c)}
                  onExpand={() => {
                    if (mode() === "search") {
                      setQuery(
                        {
                          view: "tail",
                          end: undefined,
                        },
                        { replace: true },
                      );
                    }
                  }}
                  source={logGroupKey()}
                  id={resource()?.cfnID || stateResource()?.urn!}
                  arn={
                    resource()?.metadata.arn || stateResource()?.outputs.arn!
                  }
                />
              </Show>
              <Show
                when={
                  activeSearch()?.outcome &&
                  mode() === "search" &&
                  invocations().length === 0
                }
              >
                <LogEmpty>
                  <IconMagnifyingGlass
                    width={28}
                    height={28}
                    color={theme.color.icon.dimmed}
                  />
                  <Text center color="dimmed">
                    Could not find any logs
                  </Text>
                </LogEmpty>
              </Show>
              <Show when={invocations().length > 0}>
                <KeyboardNavigator value={navigator}>
                  <For each={invocations()}>
                    {(invocation) => (
                      <InvocationRow
                        onSavePayload={() => {
                          invokeControl.savePayload(
                            structuredClone(unwrap(invocation.input)),
                          );
                        }}
                        invocation={invocation}
                        local={mode() === "live"}
                        function={
                          resource()
                            ? {
                                id: resource()!.id,
                                arn: resource()!.metadata.arn,
                                handler: resource()!.metadata.handler,
                              }
                            : {
                                id: stateResource()!.id,
                                arn: stateResources().find(
                                  (child) =>
                                    child.type ===
                                      "aws:lambda/function:Function" &&
                                    child.parent === stateResource()!.urn,
                                )?.outputs.arn,
                                handler: stateResource()!.outputs.handler,
                              }
                        }
                      />
                    )}
                  </For>
                </KeyboardNavigator>
              </Show>
              <Show when={mode() === "search"}>
                <Switch>
                  <Match when={activeSearch() && !activeSearch().outcome}>
                    <LogMoreIndicator>
                      <LogMoreIndicatorIcon>
                        <IconArrowPathSpin />
                      </LogMoreIndicatorIcon>
                      <LogMoreIndicatorCopy>
                        <Show
                          when={mode() === "search"}
                          fallback={<>Loading&hellip;</>}
                        >
                          Scanning
                          <Show when={activeSearch()?.timeStart}>
                            {" "}
                            to{" "}
                            {parseTime(activeSearch()?.timeStart!)
                              .toLocal()
                              .toLocaleString(DATETIME_LONG)}
                          </Show>
                          &hellip;
                        </Show>
                      </LogMoreIndicatorCopy>
                    </LogMoreIndicator>
                  </Match>
                  <Match when={mode() === "search" && invocations().length}>
                    <LogMoreIndicator>
                      <Switch>
                        <Match when={activeSearch()?.outcome === "completed"}>
                          <LogMoreIndicatorIcon>
                            <IconEllipsisHorizontal />
                          </LogMoreIndicatorIcon>
                          <LogMoreIndicatorCopy>
                            No more logs
                          </LogMoreIndicatorCopy>
                        </Match>
                        <Match when={activeSearch()?.outcome === "partial"}>
                          <LogMoreIndicatorIcon>
                            <IconEllipsisVertical />
                          </LogMoreIndicatorIcon>
                          <TextButton
                            onClick={() => {
                              const i = invocations();
                              createSearch(i[i.length - 1]!.start);
                            }}
                          >
                            Load more logs
                          </TextButton>
                        </Match>
                      </Switch>
                    </LogMoreIndicator>
                  </Match>
                </Switch>
              </Show>
            </LogList>
          </Stack>
          <DialogRange
            onSelect={(end) => {
              setQuery({
                view: "custom",
                end: end.toISOString(),
              });
            }}
            control={(control) => (rangeControl = control)}
          />
        </>
      </Match>
    </Switch>
  );
}
