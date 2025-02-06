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
  createMemo,
  createSignal,
  Match,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { useStageContext, useStateResources } from "../../context";
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
import { Input, inputFocusStyles, SplitOptions, SplitOptionsOption } from "@console/web/ui/form";
import {
  createLogStore,
  isInvocation,
  isLog,
  useLocalLogs,
} from "@console/web/providers/invocation";
import { DivSpacer } from "@console/web/ui/layout";
import { DateTime } from "luxon";
import { DialogRange, DialogRangeControl } from "../dialog-range";

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
  borderWidth: 1,
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

const Row = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "1px 0 1px 0",
    borderColor: theme.color.divider.base,
    borderTopColor: "transparent",
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

export function AWSNext() {
  const [s, setSearch] = useSearchParams<
    | {
      view: "cloudwatch";
      logGroup: string;
      hint: "normal" | "lambda";
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
    const functionID =
      fn()?.type === "sstv2:aws:Function"
        ? fn()?.outputs.localId
        : search.functionID;
    return localLogs.get(functionID);
  });

  let rangeControl: DialogRangeControl;

  const [filter, setFilter] = createStore<{
    start?: number;
    last?: number;
    next?: string
    loading: boolean;
  }>({
    loading: false,
  });

  async function fetchCloudwatch() {
    console.log("fetching cloudwatch")
    if (search.view === "local") return;
    if (filter.loading) {
      console.log("already fetching")
      return
    }
    setFilter("loading", true);

    let total = 0;
    (async function loop() {
      const result = await api.client.log.aws.filter
        .$get({
          query: {
            group: search.logGroup,
            stageID: stage.stage.id,
            hint: search.hint,
            next: filter.next,
            start: filter.last as any,
          },
        })
        .then((r) => r.json());
      cloudwatch.ingest(result.entries);
      total += result.entries.length;
      const getmore = total < 50;
      setFilter({
        start: filter.start ?? result.start,
        loading: getmore,
        next: result.next,
        last: result.start,
      });
      if (getmore) {
        if (!result.next) {
          total = 0
          const last = cloudwatch.all.at(-1)!
          console.log("last", last)
          setFilter("last", isLog(last) ? last.timestamp : last.start)
          setTimeout(loop, 3000)
          return
        }
        loop();
        return
      }
      console.log("done looping")
      setFilter("loading", false);
    })()
  }
  onMount(() => {
    fetchCloudwatch();
  });

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
  let invokeControl!: InvokeControl;

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
                  <Show when={filter.start} fallback="Finding recent...">
                    Logs from {DateTime.fromMillis(filter.start!).toLocal().toLocaleString(DateTime.DATETIME_FULL)}
                  </Show>
                )}
              </Match>
            </Switch>
          </HeaderDescription>
        </HeaderLeft>
        <HeaderRight>
          <TextButton
            onClick={() => rangeControl.show()}
          >Jump to</TextButton>
          <TextButton onClick={() => {
            if (search.view === "cloudwatch") {
              cloudwatch.clear()
              setFilter({
                start: Date.now(),
                last: Date.now(),
                next: undefined,
              })
              fetchCloudwatch()
            }
            if (search.view === "local") {
              const functionID =
                fn()?.type === "sstv2:aws:Function"
                  ? fn()?.outputs.localId
                  : search.functionID;
              localLogs.clear(functionID);
            }
          }}>Clear</TextButton>
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
        onScroll={offset => {
          console.log(vlist!.scrollSize - vlist!.scrollOffset, vlist!.viewportSize)
          if ((vlist!.scrollSize - vlist!.scrollOffset) === vlist!.viewportSize) {
            fetchCloudwatch();
          }
        }}
      >
        {(entry, index) => typeof entry !== "symbol" ? (
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
        ) : (
          <Show when={search.view === "cloudwatch"}>
            <LogMoreIndicator >
              <LogMoreIndicatorIcon>
                <IconArrowPathSpin />
              </LogMoreIndicatorIcon>
              <LogMoreIndicatorCopy>Waiting for more logs&hellip;</LogMoreIndicatorCopy>
            </LogMoreIndicator>
          </Show>
        )}
      </VList>
      <DialogRange control={r => rangeControl = r} onSelect={start => {
        cloudwatch.clear()
        setFilter({
          start: start.getTime(),
          last: start.getTime(),
          next: undefined,
        })
        fetchCloudwatch()
      }} />
    </Root>
  );
}

const END_SYMBOL = Symbol("end");
