import {
  IconArrowsUpDown,
  IconArrowDown,
  IconBoltSolid,
  IconArrowPathRoundedSquare,
  IconCheck,
  IconEllipsisHorizontal,
  IconEllipsisVertical,
} from "@console/web/ui/icons";
import { VList, VirtualizerHandle } from "virtua/solid";
import { styled } from "@macaron-css/solid";
import { useSearchParams } from "@solidjs/router";
import { createMultiList } from "solid-list";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useStageContext, useStateResources } from "../../context";
import { DateTime } from "luxon";
import { DATETIME_LONG } from "@console/web/common/format";
import { Dropdown } from "@console/web/ui/dropdown";
import { Invoke, InvokeControl } from "../invoke";
import { TextButton, IconButton } from "@console/web/ui/button";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { InvocationRow } from "@console/web/common/invocation";
import { useApi } from "@console/web/pages/workspace/context";
import { IconArrowPathSpin } from "@console/web/ui/icons/custom";
import { createStore } from "solid-js/store";
import { createEventListener } from "@solid-primitives/event-listener";
import { style } from "@macaron-css/core";
import { inputFocusStyles } from "@console/web/ui/form";
import {
  createLogStore,
  isInvocation,
  isLog,
  useLocalLogs,
} from "@console/web/providers/invocation";
import { DivSpacer } from "@console/web/ui/layout";

const shortDateOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  hour12: true,
  minute: "numeric",
  second: "numeric",
  timeZoneName: "short",
};
const longDateOptions: Intl.DateTimeFormatOptions = {
  ...shortDateOptions,
  timeZone: "UTC",
  year: "numeric",
};

const LogLoadingIndicator = styled("div", {
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
const LogLoadingIndicatorIcon = styled("div", {
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

const LogLoadingIndicatorIconSvg = style({
  selectors: {
    [`${LogLoadingIndicatorIcon.selector({ pulse: true })} &`]: {
      animation: "glow-pulse 1.7s linear infinite alternate",
    },
  },
});
const Root = styled("div", {
  base: {
    padding: theme.space[4],
    height: `calc(100vh - ${theme.headerHeight.root} - ${theme.headerHeight.stage})`,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
});

const PageHeader = styled("div", {
  base: {
    ...utility.stack(2.5),
    flex: "0 0 auto",
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
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.secondary.base,
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
    position: "relative",
  },
  variants: {
    border: {
      true: {
        borderTopWidth: 1,
      },
      false: {
        borderTopWidth: 0,
      },
    },
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
  borderWidth: "0 1px",
  borderStyle: "solid",
  borderColor: theme.color.divider.base,
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
    display: "flex",
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "0 0 1px 0",
    borderColor: theme.color.divider.base,
    height: 50,
    selectors: {
      "&[data-expanded]": {
        height: "auto",
      },
      "&[data-focus]": {
        ...inputFocusStyles,
        outlineOffset: -1,
      },
    },
  },
});

const LogRowRoot = styled("div", {
  base: {
    ...utility.row(2),
    padding: `calc(${theme.space[1.5]} + 0.125rem) ${theme.space[3]} calc(${theme.space[1.5]} + 0.125rem) calc(${theme.space[3]} + 0.5rem)`,
  },
});

const LogTimestamp = styled("div", {
  base: {
    ...utility.text.line,
    userSelect: "none",
    WebkitUserSelect: "none",
    lineHeight: 2.4,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.secondary.base,
    flexShrink: 0,
    minWidth: 190,
  },
});

const LogMessage = styled("div", {
  base: {
    lineHeight: 2.4,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
  },
  variants: {
    expanded: {
      true: {
        height: "auto",
        overflow: "visible",
      },
      false: {
        height: 31,
        overflow: "hidden",
      },
    },
  },
});

interface LogRowProps {
  expanded?: boolean;
  timestamp: number;
  message: string;
}
function LogRow(props: LogRowProps) {
  const shortDate = createMemo(() =>
    new Intl.DateTimeFormat("en-US", shortDateOptions)
      .format(props.timestamp)
      .replace(" at ", ", "),
  );
  const longDate = createMemo(() =>
    new Intl.DateTimeFormat("en-US", longDateOptions).format(props.timestamp),
  );
  return (
    <LogRowRoot>
      <LogTimestamp title={longDate()}>{shortDate()}</LogTimestamp>
      <LogMessage expanded={props.expanded}>{props.message}</LogMessage>
    </LogRowRoot>
  );
}

export function AWS() {
  const [s, setSearch] = useSearchParams<
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
  const search = s as Required<typeof s>;

  const stage = useStageContext();
  const api = useApi();
  const localLogs = useLocalLogs();
  const tailed = createLogStore(-1);
  const past = createLogStore(-1);
  const resources = useStateResources();
  const fn = createMemo(() => {
    if (search.view) {
      if (search.view === "local") {
        const match = resources().find((r) => r.urn === search.functionID);
        return match;
      }
      if (search.hint === "lambda") {
        const match = resources().find(
          (r) =>
            r.outputs?.loggingConfig?.logGroup === search.logGroup ||
            r.outputs?.enrichment?.logGroup === search.logGroup,
        );
        if (match?.type === "sstv2:aws:Function") return match;
        const fn = resources().find((r) => r.urn === match?.parent);
        return fn;
      }
    }
  });
  const local = createMemo(() => {
    if (search.view !== "local") return [];
    console.log(fn());
    const functionID =
      fn()?.type === "sstv2:aws:Function"
        ? fn()?.outputs.localId
        : search.functionID;
    return localLogs.get(functionID);
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
      start: result.start || undefined,
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

  const description = createMemo(() => {
    if (fn())
      return fn()?.outputs?._metadata?.handler || fn()?.outputs?.handler;
    if (search.view !== "local") return search.logGroup;
  });

  const lambdaARN = createMemo(() => {
    const f = fn();
    if (!f) return;
    if (f?.type === "sstv2:aws:Function") return f.outputs.arn;
    const child = resources().find(
      (r) => r.parent === f.urn && r.type === "aws:lambda/function:Function",
    );
    return child?.outputs.arn;
  });

  const [scrollEnd, setScrollEnd] = createSignal(false);
  // Check if the logs have loaded
  const showBorder = createMemo(() => rows().length > 0 && !scrollEnd());
  let invokeControl!: InvokeControl;

  createEffect((old?: { size: number, rows: number }) => {
    if (old?.rows !== rows().length && vlist?.scrollOffset !== 0) {
      const oldSize = old?.rows || 0;
      const newSize = rows().length || 0;
      const diff = (newSize - oldSize) * 50;
      if (diff !== 0)
        vlist?.scrollTo(vlist?.scrollOffset! + diff);
    }
    return {
      size: vlist?.scrollSize || 0,
      rows: rows().length
    }
  })

  return (
    <Root>
      <PageHeader>
        <PageHeaderTitle>Logs</PageHeaderTitle>
        <PageHeaderDesc>{description()}</PageHeaderDesc>
      </PageHeader>
      <DivSpacer space="4" />
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
              <Match when={(console.log("stage", stage.connected), search.view === "local" && !stage.connected)}>
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
                if (search.view === "local") {
                  const functionID =
                    fn()?.type === "sstv2:aws:Function"
                      ? fn()?.outputs.localId
                      : search.functionID;
                  localLogs.clear(functionID);
                }
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
      <Show when={lambdaARN()}>
        <Invoke
          arn={lambdaARN()!}
          control={(c) => (invokeControl = c)}
          onExpand={() => {
            if (search.view === "past")
              setSearch(
                {
                  view: "live",
                },
                {
                  replace: true,
                },
              );
          }}
          onInvoke={async (payload) => {
            const result = await api.client.lambda.invoke
              .$post({
                json: {
                  stageID: stage.stage.id,
                  payload,
                  functionARN: lambdaARN()!,
                },
              })
              .then((r) => r.json());
            tailed.ingest([
              {
                id: result.requestID!,
                start: Date.now(),
                logs: [],
                cold: false,
                input: payload,
              },
            ]);
          }}
        />
      </Show>
      <Show when={rows().length}>
        <VList
          class={Scroller}
          ref={(r) => (vlist = r)}
          data={rows()}
          overscan={10}
          onScroll={() => {
            setScrollEnd(
              vlist?.scrollOffset! -
              vlist?.scrollSize! +
              vlist?.viewportSize! >=
              -1.5,
            );
          }}
        >
          {(entry) => (
            <Row
              data-focus={list.cursor() === entry.id ? true : undefined}
              data-row-id={entry.id}
              data-expanded={list.selected().includes(entry.id) ? true : undefined}
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
                        invocation={{
                          ...invocation(),
                          errors: [],
                        }}
                        onSavePayload={async () => {
                          invokeControl.savePayload(invocation()?.input!);
                        }}
                        onReplay={async () => {
                          if (!lambdaARN()) return;
                          await api.client.lambda.invoke.$post({
                            json: {
                              stageID: stage.stage.id,
                              functionARN: lambdaARN()!,
                              payload: invocation()?.input,
                            },
                          });
                          console.log(lambdaARN);
                        }}
                        local={search.view === "local"}
                      />
                    );
                  }}
                </Match>
                <Match when={isLog(entry) && entry}>
                  {(log) => (
                    <LogRow
                      message={log().message}
                      timestamp={log().timestamp}
                      expanded={list.selected().includes(entry.id)}
                    />
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
            <LogMoreIndicator border={showBorder()}>
              <LogMoreIndicatorIcon>
                <IconArrowPathSpin />
              </LogMoreIndicatorIcon>
              <LogMoreIndicatorCopy>Scanning logs&hellip;</LogMoreIndicatorCopy>
            </LogMoreIndicator>
          </Match>
          <Match when={past.all.length === 0 && pastResult.completed}>
            <LogMoreIndicator border={showBorder()}>
              <LogMoreIndicatorIcon>
                <IconEllipsisHorizontal />
              </LogMoreIndicatorIcon>
              <LogMoreIndicatorCopy>No logs found</LogMoreIndicatorCopy>
            </LogMoreIndicator>
          </Match>
          <Match when={past.all.length}>
            <LogMoreIndicator border={showBorder()}>
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
