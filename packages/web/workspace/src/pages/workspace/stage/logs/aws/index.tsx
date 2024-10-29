import {
  IconArrowsUpDown,
  IconArrowDown,
  IconBoltSolid,
  IconArrowPathRoundedSquare,
  IconCheck,
  IconEllipsisHorizontal,
  IconEllipsisVertical,
} from "$/ui/icons";
import { VList, VirtualizerHandle } from "virtua/solid";
import { styled } from "@macaron-css/solid";
import { useSearchParams } from "@solidjs/router";
import { createMultiList } from "solid-list";
import {
  batch,
  createMemo,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { LogLoadingIndicatorIconSvg } from "../detail";
import {
  useResourcesContext,
  useStageContext,
  useStateResources,
} from "../../context";
import { DateTime } from "luxon";
import { DATETIME_LONG } from "$/common/format";
import { Dropdown } from "$/ui/dropdown";
import { Invoke } from "../invoke";
import { TextButton, IconButton } from "$/ui/button";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Text } from "$/ui/text";
import { InvocationRow } from "$/common/invocation";
import { useApi } from "$/pages/workspace/context";
import { IconArrowPathSpin } from "$/ui/icons/custom";
import { createStore } from "solid-js/store";
import { createEventListener } from "@solid-primitives/event-listener";
import { style } from "@macaron-css/core";
import { inputFocusStyles } from "$/ui/form";
import {
  createLogStore,
  isInvocation,
  isLog,
  useLocalLogs,
} from "$/providers/invocation";
import { Stack } from "$/ui/layout";

const Root = styled("div", {
  base: {
    padding: theme.space[4],
    height: "calc(100vh - 52px - 68px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
});

const Header = styled("div", {
  base: {
    ...utility.row(0),
    flexShrink: 0,
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

export const HeaderIcon = styled("div", {
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
        "& > svg": {
          animation: "glow-pulse 1.7s linear infinite alternate",
        },
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

export const HeaderDescription = styled("span", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

export const HeaderLeft = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
  },
});

export const HeaderRight = styled("div", {
  base: {
    ...utility.row(3.5),
    alignItems: "center",
  },
});

const LogMoreIndicator = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: `${theme.space[3]} ${theme.space[3]}`,
    borderStyle: "solid",
    borderWidth: "1px",
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

const Scroller = style({
  selectors: {
    "&::-webkit-scrollbar": {
      display: "none",
    },
    "&:empty": {
      display: "none",
    },
  },
});

const Row = styled("div", {
  base: {
    width: "100%",
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    selectors: {
      "&[data-focus]": {
        ...inputFocusStyles,
        outlineOffset: -1,
      },
    },
  },
});

export function AWS() {
  const [search, setSearch] = useSearchParams<
    | {
        logGroup: string;
        hint: "normal" | "lambda";
        view: "live" | "past";
        end?: string;
      }
    | {
        view: "local";
        functionID: string;
      }
  >();

  const stage = useStageContext();
  const api = useApi();
  const localLogs = useLocalLogs();
  const tailed = createLogStore(-1);
  const past = createLogStore(-1);
  const local = createMemo(() => {
    if (search.view !== "local") return [];
    return localLogs.get(search.functionID);
  });

  const tailer = setInterval(() => {
    if (search.view === "local") return;
    api.client.log.aws.tail
      .$get({
        query: {
          stageID: stage.stage.id,
          logGroup: search.logGroup,
          hint: search.hint,
        },
      })
      .then((r) => r.json())
      .then((val) => tailed.ingest(val as any));
  }, 3000);
  onCleanup(() => {
    clearInterval(tailer);
  });

  const [pastResult, setPastResult] = createStore<{
    start?: string;
    completed?: boolean;
    loading: boolean;
  }>({
    loading: false,
  });
  async function fetchPast() {
    if (search.view === "local") return;
    setPastResult("loading", true);
    const result = await api.client.log.aws.past
      .$get({
        query: {
          logGroup: search.logGroup,
          stageID: stage.stage.id,
          end: pastResult.start,
          hint: search.hint,
        },
      })
      .then((r) => r.json());
    past.ingest(result.invocations);
    setPastResult({
      start: result.start,
      completed: result.completed,
      loading: false,
    });
  }
  onMount(() => {
    fetchPast();
  });

  const rows = createMemo(() => {
    if (search.view === "local") return local();
    if (search.view === "live") return tailed.all;
    return past.all;
  });

  let vlist: VirtualizerHandle | undefined;
  const list = createMultiList({
    items: () => rows().map((item) => item.id),
    vimMode: true,
    loop: false,
    handleTab: true,
    onSelectedChange: console.log,
    onCursorChange: (cursor) => {
      console.log(cursor);
      if (cursor == null) return;
      const index = rows().findIndex((tx) => tx.id === cursor);
      document.querySelector<HTMLElement>(`[data-row-id="${cursor}"]`)?.focus();
      vlist?.scrollToIndex(index, {
        align: "nearest",
      });
    },
  });

  createEventListener(window, "keydown", (e) => {
    if (document.activeElement?.tagName === "INPUT") return;
    if (document.activeElement?.tagName === "TEXTAREA") return;
    if (e.key === "Enter" || e.key === "x") {
      const id = list.cursor();
      if (id) list.toggleSelected(id);
      return;
    }
    list.onKeyDown(e);
  });

  const resources = useStateResources();
  const description = createMemo(() => {
    if (search.view === "local")
      return resources().find((r) => r.urn === search.functionID)?.outputs
        ?._metadata.handler;
    if (search.hint === "lambda") {
      const lambda = resources().find(
        (r) => r.outputs?.loggingConfig?.logGroup === search.logGroup,
      );
      const fn = resources().find((r) => r.urn === lambda?.parent);
      return fn?.outputs?._metadata.handler;
    }

    return search.logGroup;
  });

  return (
    <Root>
      <Stack space="2">
        <Text size="lg" weight="medium">
          Logs
        </Text>
        <Text size="lg" color="dimmed">
          {description()}
        </Text>
      </Stack>
      <Header>
        <HeaderLeft>
          <HeaderIcon
            pulse={search.view !== "past"}
            glow={
              (search.view === "local" && stage.connected) ||
              search.view === "live"
            }
          >
            <Switch>
              <Match when={search.view === "local" && !stage.connected}>
                <IconArrowsUpDown />
              </Match>
              <Match when={search.view === "past"}>
                <IconArrowDown />
              </Match>
              <Match when={true}>
                <IconBoltSolid class={LogLoadingIndicatorIconSvg} />
              </Match>
            </Switch>
          </HeaderIcon>
          <HeaderDescription>
            <Switch>
              <Match when={search.view === "local" && !stage.connected}>
                Trying to connect to local `sst dev`
              </Match>
              <Match when={search.view === "local"}>
                Tailing logs from local `sst dev`
              </Match>
              <Match when={search.view === "past" && search}>
                {(search) => (
                  <Show when={search().end} fallback="Viewing past logs">
                    <span>
                      Viewing logs older than{" "}
                      {DateTime.fromISO(search().end!).toLocaleString(
                        DATETIME_LONG,
                      )}
                    </span>
                  </Show>
                )}
              </Match>
              <Match when={search.view === "live"}>Tailing logs</Match>
            </Switch>
          </HeaderDescription>
        </HeaderLeft>
        <HeaderRight>
          <Show when={search.view === "local" || search.view === "live"}>
            <TextButton
              onClick={() => {
                if (search.view === "live") tailed.clear();
                if (search.view === "local") localLogs.clear(search.functionID);
              }}
            >
              Clear
            </TextButton>
          </Show>
          <Show when={search.view === "past"}>
            <IconButton
              title="Reload logs"
              onClick={() => {
                batch(() => {
                  setPastResult({
                    start: undefined,
                    completed: false,
                  });
                  past.clear();
                  list.setSelected([]);
                  fetchPast();
                });
              }}
            >
              <IconArrowPathRoundedSquare
                display="block"
                width={20}
                height={20}
              />
            </IconButton>
          </Show>
          <Show when={search.view !== "local"}>
            <Dropdown size="sm" label="View">
              <Dropdown.RadioGroup
                value={search.view}
                onChange={(val) => {
                  if (val === "custom") {
                    return;
                  }
                  setSearch(
                    {
                      view: val,
                    },
                    {
                      replace: true,
                    },
                  );
                }}
              >
                <Dropdown.RadioItem closeOnSelect value="live">
                  <Dropdown.RadioItemLabel>Live</Dropdown.RadioItemLabel>
                  <Dropdown.ItemIndicator>
                    <IconCheck width={14} height={14} />
                  </Dropdown.ItemIndicator>
                </Dropdown.RadioItem>
                <Dropdown.RadioItem closeOnSelect value="past">
                  <Dropdown.RadioItemLabel>Past</Dropdown.RadioItemLabel>
                  <Dropdown.ItemIndicator>
                    <IconCheck width={14} height={14} />
                  </Dropdown.ItemIndicator>
                </Dropdown.RadioItem>
                {/*
                <Dropdown.RadioItem
                  onSelect={() => {}}
                  closeOnSelect
                  value="custom"
                >
                  Jump to&hellip;
                </Dropdown.RadioItem>
                */}
              </Dropdown.RadioGroup>
            </Dropdown>
          </Show>
        </HeaderRight>
      </Header>
      <Invoke arn="" source="" id="" control={() => {}} onExpand={() => {}} />
      <Show when={rows().length}>
        <VList class={Scroller} ref={(r) => (vlist = r)} data={rows()}>
          {(entry, index) => (
            <Row
              data-focus={list.cursor() === entry.id ? true : undefined}
              data-row-id={entry.id}
              onClick={() => {
                list.toggleSelected(entry.id);
                list.setCursor(entry.id);
              }}
            >
              <Switch>
                <Match when={isInvocation(entry) && entry}>
                  {(invocation) => {
                    return (
                      <InvocationRow
                        expanded={list.selected().includes(entry.id)}
                        invocation={invocation()}
                        local={search.view === "local"}
                      />
                    );
                  }}
                </Match>
                <Match when={isLog(entry) && entry}>
                  {(log) => (
                    <span>
                      {log().timestamp} {log().message}
                    </span>
                  )}
                </Match>
              </Switch>
            </Row>
          )}
        </VList>
      </Show>
      <Show when={search.view === "past"}>
        <Switch>
          <Match when={pastResult.loading}>
            <LogMoreIndicator>
              <LogMoreIndicatorIcon>
                <IconArrowPathSpin />
              </LogMoreIndicatorIcon>
              <LogMoreIndicatorCopy>Scanning logs&hellip;</LogMoreIndicatorCopy>
            </LogMoreIndicator>
          </Match>
          <Match when={past.all.length}>
            <LogMoreIndicator>
              <Switch>
                <Match when={pastResult.completed}>
                  <LogMoreIndicatorIcon>
                    <IconEllipsisHorizontal />
                  </LogMoreIndicatorIcon>
                  <LogMoreIndicatorCopy>No more logs</LogMoreIndicatorCopy>
                </Match>
                <Match when={true}>
                  <LogMoreIndicatorIcon>
                    <IconEllipsisVertical />
                  </LogMoreIndicatorIcon>
                  <TextButton onClick={() => fetchPast()}>
                    Load more logs
                  </TextButton>
                </Match>
              </Switch>
            </LogMoreIndicator>
          </Match>
        </Switch>
      </Show>
    </Root>
  );
}
