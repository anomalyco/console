import { styled } from "@macaron-css/solid";
import {
  LogList,
  LogLoadingIndicator,
  LogLoadingIndicatorIcon,
  LogLoadingIndicatorIconSvg,
} from "../logs/detail";
import { InvocationRow } from "$/common/invocation";
import { For, Match, Show, Switch, createMemo } from "solid-js";
import {
  useResourcesContext,
  useStageContext,
  useStateResources,
} from "../context";
import { concat, filter, map, pipe } from "remeda";
import { IconArrowsUpDown, IconBoltSolid } from "$/ui/icons";
import { useLocalLogs } from "$/providers/invocation";
import {
  KeyboardNavigator,
  createKeyboardNavigator,
} from "$/common/keyboard-navigator";
import { TextButton } from "$/ui/button";
import { Row } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Text } from "$/ui/text";

const Root = styled("div", {
  base: {
    padding: theme.space[4],
    ...utility.stack(5),
  },
});

export function Local() {
  const resources = useResourcesContext();
  const stateResources = useStateResources();
  const functionByLocalID = createMemo(() =>
    Object.fromEntries(
      concat(
        pipe(
          resources(),
          filter((item) => item.type === "Function"),
          map((item) => [
            item.metadata.localId,
            {
              id: item.metadata.localId,
              handler: item.metadata.handler,
              arn: item.metadata.arn,
            },
          ]),
        ),
        pipe(
          stateResources(),
          filter((item) => item.type === "sst:aws:Function"),
          map((item) => [
            item.urn,
            {
              id: item.id,
              handler: item.outputs._metadata.handler,
              arn: stateResources().find(
                (child) =>
                  child.type === "aws:lambda/function:Function" &&
                  child.parent === item.urn,
              )?.outputs.arn,
            },
          ]),
        ),
      ),
    ),
  );
  const ctx = useStageContext();
  const localLogs = useLocalLogs();
  const entries = createMemo(() => localLogs.get("all").toReversed());
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
    <Root>
      <LogList>
        <LogLoadingIndicator>
          <Row space="2" vertical="center">
            <LogLoadingIndicatorIcon pulse={true} glow={true}>
              <Switch>
                <Match when={!ctx.connected}>
                  <IconArrowsUpDown />
                </Match>
                <Match when={true}>
                  <IconBoltSolid class={LogLoadingIndicatorIconSvg} />
                </Match>
              </Switch>
            </LogLoadingIndicatorIcon>
            <Text leading="normal" color="dimmed" size="sm">
              <Switch>
                <Match when={!ctx.connected}>
                  Trying to connect to local `sst dev`&hellip;
                </Match>
                <Match when={true}>
                  Tailing logs from local `sst dev`&hellip;
                </Match>
              </Switch>
            </Text>
          </Row>
          <div>
            <Show when={entries().length > 0}>
              <TextButton
                onClick={() => {
                  localLogs.clear("all");
                }}
              >
                Clear
              </TextButton>
            </Show>
          </div>
        </LogLoadingIndicator>
        <KeyboardNavigator value={navigator}></KeyboardNavigator>
      </LogList>
    </Root>
  );
}
