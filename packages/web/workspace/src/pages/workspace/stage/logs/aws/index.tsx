import {
  IconArrowsUpDown,
  IconArrowDown,
  IconBoltSolid,
  IconArrowPathRoundedSquare,
  IconCheck,
} from "$/ui/icons";
import { styled } from "@macaron-css/solid";
import { useSearchParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";
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

export function AWS() {
  const [search, setSearch] = useSearchParams<{
    logGroup: string;
    hint: "normal" | "lambda";
    view: "live" | "past" | "local";
    end?: string;
  }>();

  const stage = useStageContext();

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
                <Match when={search.view === "live"}>
                  Tailing logs since bye
                </Match>
              </Switch>
            </HeaderDescription>
          </HeaderLeft>
          <HeaderRight>
            <Show when={search.view === "local" || search.view === "live"}>
              <TextButton onClick={() => {}}>Clear</TextButton>
            </Show>
            <Show when={search.view === "past"}>
              <IconButton title="Reload logs" onClick={() => {}}>
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
      </div>
    </Root>
  );
}
