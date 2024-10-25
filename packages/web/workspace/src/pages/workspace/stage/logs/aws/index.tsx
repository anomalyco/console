import {
  IconArrowsUpDown,
  IconArrowDown,
  IconBoltSolid,
  IconArrowPathRoundedSquare,
  IconCheck,
  IconEllipsisHorizontal,
  IconEllipsisVertical,
} from "$/ui/icons";
import { VListHandle, WindowVirtualizer } from "virtua/solid";
import { styled } from "@macaron-css/solid";
import { useSearchParams } from "@solidjs/router";
import { createMultiList } from "solid-list";
import {
  batch,
  createEffect,
  createMemo,
  createResource,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { LogLoadingIndicatorIconSvg } from "../detail";
import { useStageContext } from "../../context";
import { DateTime } from "luxon";
import { DATETIME_LONG } from "$/common/format";
import { Dropdown } from "$/ui/dropdown";
import { Invoke } from "../invoke";
import { TextButton, IconButton } from "$/ui/button";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Text } from "$/ui/text";
import { InvocationRow } from "$/common/invocation";
import { hc } from "hono/client";
import type { app } from "@console/functions/api/api";
import { useApi } from "$/pages/workspace/context";
import { createInvocationStore } from "$/data/invocation";
import { IconArrowPathSpin } from "$/ui/icons/custom";
import { createStore } from "solid-js/store";
import { createEventListener } from "@solid-primitives/event-listener";

const Root = styled("div", {
  base: {
    padding: theme.space[4],
    ...utility.stack(5),
  },
});

const Header = styled("div", {
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

export function AWS() {
  const [search, setSearch] = useSearchParams<{
    logGroup: string;
    hint: "normal" | "lambda";
    view: "live" | "past" | "local";
    end?: string;
  }>();

  const stage = useStageContext();
  const api = useApi();
  const tailed = createInvocationStore();
  const past = createInvocationStore();

  const tailer = setInterval(() => {
    if (search.view === "local") return;
    api.client.log.aws.tail
      .$post({
        json: {
          stageID: stage.stage.id,
          logGroup: search.logGroup,
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
    setPastResult("loading", true);
    const result = await api.client.log.aws.past
      .$get({
        query: {
          logGroup: search.logGroup,
          stageID: stage.stage.id,
          end: pastResult.start,
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

  const invocations = createMemo(() =>
    search.view === "live" ? tailed.all.toReversed() : past.all,
  );
  const list = createMultiList({
    items: () => invocations().map((item) => item.id),
    vimMode: true,
    loop: false,
    handleTab: true,
    onSelectedChange: console.log,
    onCursorChange: (cursor) => {
      console.log(cursor);
      if (cursor == null) return;
      // const index = invocations().findIndex((tx) => tx.id === cursor);
      // document
      //   .querySelector(`[data-invocation-id=${cursor}]`)
      //   ?.scrollIntoView();
    },
  });

  createEventListener(window, "keydown", (e) => {
    list.onKeyDown(e);
  });

  return (
    <Root>
      <Text size="lg" weight="medium">
        Logs
      </Text>
      <div>
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
                <Match when={search.view === "past"}>
                  <Show when={search.end} fallback="Viewing past logs">
                    <span>
                      Viewing logs older than{" "}
                      {DateTime.fromISO(search.end!).toLocaleString(
                        DATETIME_LONG,
                      )}
                    </span>
                  </Show>
                </Match>
                <Match when={search.view === "live"}>Tailing logs</Match>
              </Switch>
            </HeaderDescription>
          </HeaderLeft>
          <HeaderRight>
            <Show when={search.view === "local" || search.view === "live"}>
              <TextButton onClick={() => tailed.clear()}>Clear</TextButton>
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
                  <Dropdown.RadioItem
                    onSelect={() => {}}
                    closeOnSelect
                    value="custom"
                  >
                    Jump to&hellip;
                  </Dropdown.RadioItem>
                </Dropdown.RadioGroup>
              </Dropdown>
            </Show>
          </HeaderRight>
        </Header>
        <Invoke arn="" source="" id="" control={() => {}} onExpand={() => {}} />
        <Show when={invocations().length}>
          <WindowVirtualizer data={invocations()}>
            {(invocation, index) => (
              <InvocationRow
                onClick={() => list.toggleSelected(invocation.id)}
                expanded={list.selected().includes(invocation.id)}
                focus={list.cursor() === invocation.id}
                invocation={invocation}
                function={{
                  arn: "",
                  handler: "",
                  id: `function-${index}`,
                }}
                local={false}
              />
            )}
          </WindowVirtualizer>
        </Show>
        <Show when={search.view === "past"}>
          <Switch>
            <Match when={pastResult.loading}>
              <LogMoreIndicator>
                <LogMoreIndicatorIcon>
                  <IconArrowPathSpin />
                </LogMoreIndicatorIcon>
                <LogMoreIndicatorCopy>
                  Scanning logs&hellip;
                </LogMoreIndicatorCopy>
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
      </div>
    </Root>
  );
}
