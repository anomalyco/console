import {
  IconTrash,
  IconCalendar,
  IconBoltSolid,
  IconArrowDown,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsUpDown,
  IconMagnifyingGlass,
} from "@console/web/ui/icons";
import { VList, VirtualizerHandle } from "virtua/solid";
import { styled } from "@macaron-css/solid";
import { NavigateOptions, useSearchParams } from "@solidjs/router";
import { createMultiList } from "solid-list";
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  on,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useStageContext, useStateResources } from "../../context";
import { Invoke, InvokeControl } from "../invoke";
import { Button, TextButton, IconButton, ButtonIcon } from "@console/web/ui/button";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { InvocationRow } from "@console/web/common/invocation";
import { useApi } from "@console/web/pages/workspace/context";
import { IconClearLogs, IconResetTime, IconArrowPathSpin } from "@console/web/ui/icons/custom";
import { createEventListener } from "@solid-primitives/event-listener";
import { globalStyle, style, globalKeyframes } from "@macaron-css/core";
import { Input, inputFocusStyles, } from "@console/web/ui/form";
import {
  createLogStore,
  isInvocation,
  isLog,
  useLocalLogs,
} from "@console/web/providers/invocation";
import { Row, DivSpacer } from "@console/web/ui/layout";
import { DateTime } from "luxon";
import { DialogRange, DialogRangeControl } from "./dialog-range";
import { useCommandBar } from "../../../command-bar";

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
    height: 56,
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

export const HeaderDescription = styled("div", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
    display: "flex",
    alignItems: "center",
    gap: theme.space[2],
  },
});

export const HeaderLeft = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
  },
});

const resetTimeStyle = style({
  position: "relative",
  top: "1px",
});

export const HeaderRight = styled("div", {
  base: {
    ...utility.row(4),
    alignItems: "center",
  },
});

const SearchRoot = styled("div", {
  base: {
    position: "relative",
  },
});

const SearchInput = styled(Input, {
  base: {
    width: 220,
    paddingLeft: 30,
    flexShrink: 0,
    selectors: {
      "&[data-dirty='true']": {
        paddingRight: 44,
      },
    },
  },
});

const searchIconStyles = style({
  position: "absolute",
  top: 8,
  left: 10,
  opacity: theme.iconOpacity,
  color: theme.color.text.secondary.surface,
  pointerEvents: "none",
});

const SearchButton = styled("button", {
  base: {
    display: "none",
    position: "absolute",
    top: 5,
    right: 6,
    letterSpacing: 0.5,
    fontSize: theme.font.size.mono_xs,
    padding: `0 ${theme.space[1.5]}`,
    alignItems: "center",
    textTransform: "uppercase",
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.divider.surface,
    lineHeight: "normal",
    color: theme.color.text.secondary.surface,
    height: 22,
    ":hover": {
      color: theme.color.text.primary.surface,
    },
  },
});

globalStyle(`${SearchRoot} > ${SearchInput}[data-dirty="true"] + ${SearchButton}`, {
  display: "block",
});

const LogMoreIndicator = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: `${theme.space[3]} ${theme.space[3]}`,
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
  borderWidth: "0px 1px 1px 1px",
  borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
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

const ListRow = styled("div", {
  base: {
    width: "100%",
    borderStyle: "solid",
    borderWidth: "1px 0 1px 0",
    borderColor: theme.color.divider.base,
    borderTopColor: "transparent",
    boxSizing: "border-box",
    height: 50,
    minHeight: 50,
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
    padding: `calc(${theme.space[1.5]} + 0.125rem) ${theme.space[3]} calc(${theme.space[1.5]} + 0.125rem) ${theme.space[4]}`,
    width: "100%",
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
    flex: "1 1 auto",
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
        display: "-webkit-box",
        WebkitLineClamp: 1,
        overflow: "hidden",
        WebkitBoxOrient: "vertical",
        height: 31,
      },
    },
  },
});

const LogStreamLink = styled("div", {
  base: {
    flex: "0 0 auto",
    display: "flex",
    justifyContent: "end",
    alignItems: "center",
    selectors: {
      [`${ListRow}[data-expanded="true"] &`]: {
        paddingTop: 4,
        alignItems: "flex-start",
      },
    },
  }
})

const logStreamButtonStyle = style({
  marginTop: 3,
  marginLeft: 5,
  display: "flex",
  alignItems: "center",
  gap: theme.space[0.5],
});

interface LogRowProps {
  expanded?: boolean;
  timestamp: number;
  stream?: string;
  message: string;
  onStream: () => void;
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
      <Show when={props.stream}>
        <LogStreamLink>
          {props.expanded
            ? <TextButton
              title="View in log stream"
              class={logStreamButtonStyle}
              onClick={e => {
                e.stopPropagation();
                props.onStream();
              }
              }
            >
              <span>View in log stream</span>
              <IconChevronRight width={14} height={14} />
            </TextButton>
            : <TextButton
              title="View in log stream"
              style={{ "line-height": 0 }}
              onClick={e => {
                e.stopPropagation();
                props.onStream();
              }
              }>
              <IconChevronRight width={14} height={14} />
            </TextButton>
          }
        </LogStreamLink>
      </Show>
    </LogRowRoot>
  );
}

export function AWSNext() {
  const [search, setSearch] = useSearchParams() as [
    | {
      view: "cloudwatch";
      logGroup: string;
      stream: string;
      hint: "normal" | "lambda";
      start: string;
      pattern: string;
    }
    | {
      view: "local";
      functionID: string;
    }
    , (params: any, options?: Partial<NavigateOptions>) => void];
  const stage = useStageContext();
  const api = useApi();
  const localLogs = useLocalLogs();
  const cloudwatch = createLogStore(1);
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
            r.outputs?.["loggingConfig.logGroup"] === search.logGroup ||
            r.outputs?.["enrichment.logGroup"] === search.logGroup,
        );
        if (match?.type === "sstv2:aws:Function") return match;
        const fn = resources().find((r) => r.urn === match?.parent);
        return fn;
      }
    }
  });
  const local = createMemo(() => {
    if (search.view !== "local") return [];
    const functionID =
      fn()?.type === "sstv2:aws:Function"
        ? fn()?.outputs.localId
        : search.functionID;
    return localLogs.get(functionID);
  });

  let rangeControl: DialogRangeControl;

  createEffect(on(() => search.view === "cloudwatch" ? [
    search.start,
    search.pattern,
    search.stream,
    search.logGroup,
    search.start,
    search.hint,
  ] : [], async ([start], old) => {
    if (search.view !== "cloudwatch") return
    if (!old?.[0] && start) return

    cloudwatch.clear()
    if (filterLoopState.cancel) {
      await filterLoopState.cancel()
    }
    filterLoopState.last = undefined
    filterLoopState.next = undefined
    runFilterLoop()
  }))

  onMount(() => {
    runFilterLoop()
  })


  const filterLoopState: {
    next?: string;
    last?: number;
    cancel?: () => Promise<void>;
  } = {}

  async function runFilterLoop() {
    if (search.view !== "cloudwatch") return
    if (filterLoopState.cancel) return
    let total = 0;
    let cancelled = undefined as (() => void) | undefined
    filterLoopState.cancel = async () => {
      return new Promise<void>(resolve => {
        cancelled = resolve
      })
    }
    while (true) {
      if (cancelled !== undefined) {
        cancelled()
        filterLoopState.cancel = undefined
        return
      }
      const result = await api.client.log.aws.filter
        .$get({
          query: {
            group: search.logGroup,
            stream: search.stream,
            hint: search.hint,
            pattern: search.pattern,
            stageID: stage.stage.id,
            next: filterLoopState.next,
            start: (filterLoopState.last || search.start) as any,
          },
        })
        .then((r) => r.json());
      if (cancelled) continue
      if (!search.start) {
        setSearch({ start: result.start, }, { replace: true })
      }
      cloudwatch.ingest(result.entries);
      total += result.entries.length;
      filterLoopState.next = result.next
      if (total >= 50) break
      if (!filterLoopState.next) {
        total = 0
        const last = cloudwatch.all.at(-1)!
        if (last)
          filterLoopState.last = isLog(last) ? last.timestamp : last.start
        await new Promise(resolve => setTimeout(resolve, 3000))
        continue
      }
    }
    if (cancelled !== undefined)
      // @ts-expect-error
      cancelled()
    filterLoopState.cancel = undefined
  }


  const rows = createMemo(() => {
    if (search.view === "local") return local();
    if (search.view === "cloudwatch") return cloudwatch.all;
    return []
  });

  let vlist: VirtualizerHandle | undefined;
  const list = createMultiList({
    items: () => rows().map((item) => item.id),
    vimMode: true,
    loop: false,
    handleTab: true,
    onCursorChange: (cursor) => {
      if (cursor == null) return;
      const index = rows().findIndex((tx) => tx.id === cursor);
      if (index === rows().length - 1) {
        vlist?.scrollToIndex(index + 1, {
          align: "nearest",
        })
        return
      }
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
      return fn()?.outputs?.["_metadata.handler"] || fn()?.outputs?.handler;
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

  const [searchInput, setSearchInput] = createSignal(
    search.view === "cloudwatch" && (search.pattern || "")
  );
  const isSearchDirty = createMemo(() =>
    search.view === "cloudwatch" && searchInput() !== (search.pattern || "")
  );

  let invokeControl!: InvokeControl;

  function clear() {
    if (search.view === "cloudwatch") {
      setSearch({
        start: Date.now(),
      }, {
        replace: true
      })
      return
    }
    if (search.view === "local") {
      const functionID =
        fn()?.type === "sstv2:aws:Function"
          ? fn()?.outputs.localId
          : search.functionID;
      localLogs.clear(functionID);
    }
  }

  const bar = useCommandBar();
  bar.register("log", async () => {
    return [
      {
        icon: IconCalendar,
        title: "Jump to",
        category: "Logs",
        run: (control) => {
          rangeControl.show()
          control.hide()
        },
      },
      {
        icon: IconTrash,
        title: "Clear",
        category: "Logs",
        run: (control) => {
          clear()
          control.hide()
        },
      }
    ]
  })

  // createEffect((old?: { size: number, rows: number }) => {
  //   if (old?.rows !== rows().length && vlist?.scrollOffset !== 0) {
  //     const oldSize = old?.rows || 0;
  //     const newSize = rows().length || 0;
  //     const diff = (newSize - oldSize) * 50;
  //     if (diff !== 0)
  //       vlist?.scrollTo(vlist?.scrollOffset! + diff);
  //   }
  //   return {
  //     size: vlist?.scrollSize || 0,
  //     rows: rows().length
  //   }
  // })

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
            pulse={search.view === "local"}
            glow={
              (search.view === "local" && stage.connected)
            }
          >
            <Switch>
              <Match when={search.view === "local" && !stage.connected}>
                <IconArrowsUpDown />
              </Match>
              <Match when={search.view === "cloudwatch"}>
                <IconArrowDown />
              </Match>
              <Match when={true}>
                <IconBoltSolid class={LogLoadingIndicatorIconSvg} />
              </Match>
            </Switch>
          </HeaderIcon>
          <Row space="3" vertical="center">
            <HeaderDescription>
              <Switch>
                <Match when={(console.log("stage", stage.connected), search.view === "local" && !stage.connected)}>
                  Trying to connect to local `sst dev`
                </Match>
                <Match when={search.view === "local"}>
                  Tailing logs from local `sst dev`
                </Match>
                <Match when={search.view === "cloudwatch" && search}>
                  {(search) => (
                    <Show when={search().start} fallback="Finding recent...">
                      {search().stream
                        ? "Logs from selected log stream"
                        : <>
                          Logs from{" "}
                          <Button
                            size="sm"
                            color="secondary"
                            onClick={() => rangeControl.show()}
                          >
                            {DateTime.fromMillis(parseInt(search().start)).toLocal().toLocaleString(DateTime.DATETIME_FULL)}
                          </Button>
                        </>
                      }
                    </Show>
                  )}
                </Match>
              </Switch>
            </HeaderDescription>
            {(search.view === "cloudwatch" && search && !search.stream && search.start) &&
              <IconButton
                class={resetTimeStyle}
                title="Get latest logs"
                onClick={() => clear()}
              >
                <IconResetTime width={18} height={18} />
              </IconButton>
            }
          </Row>
        </HeaderLeft>
        <HeaderRight>
          <Show when={search.view === "cloudwatch" && search.stream}>
            <Button
              size="sm"
              color="success"
              onClick={() => window.history.back()}
            >
              <ButtonIcon size="sm">
                <IconChevronLeft />
              </ButtonIcon>
              Back to search
            </Button>
          </Show>
          {
            search.view === "cloudwatch" && !search.stream &&
            <SearchRoot>
              <SearchInput
                data-dirty={isSearchDirty()}
                value={search.pattern || ""}
                onBlur={(e) => {
                  if (e.currentTarget.value === (search.pattern || "")) return
                  setSearch({
                    pattern: e.currentTarget.value,
                  }, {
                    replace: true
                  })
                }}
                onInput={(e) => { setSearchInput(e.currentTarget.value) }}
                onKeyDown={(e) => {
                  if (e.currentTarget.value === (search.pattern || "")) return
                  if (e.key === "Enter") {
                    setSearch({
                      pattern: e.currentTarget.value,
                    }, {
                      replace: true
                    })
                  }
                }}
                size="sm" placeholder="Search..." />
              <SearchButton>Go</SearchButton>
              <IconMagnifyingGlass width="15" height="15" class={searchIconStyles} />
            </SearchRoot>
          }
          {search.view !== "cloudwatch" &&
            <IconButton title="Clear" onClick={() => clear()}>
              <IconClearLogs width={20} height={20} />
            </IconButton>
          }
        </HeaderRight>
      </Header>
      <Show when={lambdaARN()}>
        <Invoke
          arn={lambdaARN()!}
          control={(c) => (invokeControl = c)}
          onExpand={() => { }}
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
            cloudwatch.ingest([
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
      <VList
        class={Scroller}
        ref={(r) => (vlist = r)}
        data={[...rows(), END_SYMBOL]}
        onScroll={() => {
          if (Math.floor(vlist!.scrollSize - vlist!.scrollOffset - vlist!.viewportSize) === 0) {
            console.log("hit end")
            if (search.view !== "cloudwatch") return
            runFilterLoop()
          }
        }}
      >
        {(entry) => typeof entry !== "symbol" ? (
          <ListRow
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
                      }}
                      local={search.view === "local"}
                    />
                  );
                }}
              </Match>
              <Match when={isLog(entry) && entry}>
                {(log) => (
                  <LogRow
                    stream={log().stream}
                    message={log().message}
                    timestamp={log().timestamp}
                    expanded={list.selected().includes(entry.id)}
                    onStream={() => {
                      setSearch({
                        stream: log().stream,
                        start: log().timestamp - 1,
                        pattern: undefined,
                      }, {
                        replace: false,
                      })
                    }}
                  />
                )}
              </Match>
            </Switch>
          </ListRow>
        ) : (
          <Show when={search.view === "cloudwatch"}>
            <LogMoreIndicator >
              <LogMoreIndicatorIcon>
                <IconArrowPathSpin />
              </LogMoreIndicatorIcon>
              <LogMoreIndicatorCopy>
                {search.view === "cloudwatch" && search.pattern
                  ? `Waiting for logs matching "${search.view === "cloudwatch" && search.pattern}"`
                  : rows().length === 0
                    ? "Waiting for logs"
                    : "Waiting for more logs"
                }
                &hellip;
              </LogMoreIndicatorCopy>
            </LogMoreIndicator>
          </Show>
        )}
      </VList>
      <DialogRange control={r => rangeControl = r} onSelect={start => {
        setSearch({
          start: start.getTime(),
        }, {
          replace: true
        })
      }} />
    </Root >
  );
}

const END_SYMBOL = Symbol("end");
