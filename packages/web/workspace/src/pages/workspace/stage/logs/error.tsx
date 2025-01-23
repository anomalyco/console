import { IconChevronDown, IconChevronRight } from "@console/web/ui/icons";
import { SpanSpacer } from "@console/web/ui/layout";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Invocation, StackFrame } from "@console/core/log/index";
import { styled } from "@macaron-css/solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { Text } from "@console/web/ui/text";

export const ErrorList = styled("div", {
  base: {
    ...utility.stack(0),
    borderRadius: theme.borderRadius,
  },
});

const Title = styled("div", {
  base: {
    fontFamily: theme.font.family.code,
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.danger.surface,
    lineHeight: theme.font.lineHeight,
    fontSize: theme.font.size.mono_base,
    wordBreak: "break-all",
    borderTop: `1px solid ${theme.color.divider.surface}`,
    padding: `${theme.space[3]} ${theme.space[4]} ${theme.space[2.5]}`,
    ":first-child": {
      borderTop: "none",
    },
  },
});

const Frame = styled("div", {
  base: {
    ...utility.stack(0),
    flex: "1 1 auto",
    borderTop: `1px solid ${theme.color.divider.surface}`,
    ":first-child": {
      borderTop: "none",
    },
  },
});

const FrameExpand = styled("button", {
  base: {
    flexShrink: 0,
    opacity: theme.iconOpacity,
    color: theme.color.text.primary.surface,
    position: "relative",
    top: 2,
  },
});

const FrameInfo = styled("div", {
  base: {
    ...utility.row(2),
    alignItems: "center",
    padding: `0 ${theme.space[4]}`,
  },
  variants: {
    dimmed: {
      "1": {
        opacity: 0.4,
      },
      "2": {
        opacity: 0.2,
      },
    },
  },
});

const FrameTitle = styled("div", {
  base: {
    padding: `${theme.space[2]} 0 calc(${theme.space[2]} + 2px)`,
    lineHeight: theme.font.lineHeight,
  },
});

const FrameContext = styled("div", {
  base: {
    padding: `${theme.space[1]} ${theme.space[5]}`,
    borderTop: `1px solid ${theme.color.divider.surface}`,
    ":first-child": {
      borderTop: "none",
    },
  },
});

const FrameContextRow = styled("div", {
  base: {
    ...utility.row(7),
    alignItems: "flex-start",
    padding: `${theme.space[0.5]} 0`,
  },
});

const FrameContextNumber = styled("div", {
  base: {
    flex: "0 0 auto",
  },
});

function countLeadingSpaces(str: string) {
  let count = 0;
  for (let char of str) {
    if (char === " ") {
      count++;
    } else if (char === "\t") {
      count += 2;
    } else {
      break;
    }
  }
  return count;
}

export function ErrorItem(props: { error: Invocation["errors"][number] }) {
  return (
    <>
      <Title>
        {props.error.error}: {props.error.message}
      </Title>
      <StackTrace stack={props.error.stack} />
    </>
  );
}

export function StackTrace(props: { stack: StackFrame[] }) {
  const first = createMemo(() =>
    Math.max(
      props.stack.findIndex((frame) => frame.important),
      0,
    ),
  );
  const anyContext = createMemo(() =>
    props.stack.some((frame) => frame.context),
  );

  function renderStacktraceFrameContext(start: number, context: string[]) {
    // Find the minimum number of leading spaces across all context lines
    const minLeadingSpaces = Math.min(
      ...context.map((row) => countLeadingSpaces(row)),
    );
    const offset = Math.max(1, start - 3);
    const active = Math.min(3, start - 1);

    return (
      <FrameContext>
        <For each={context}>
          {(line, index) => (
            <FrameContextRow>
              <FrameContextNumber>
                <Text
                  code
                  on="surface"
                  disableSelect
                  size="mono_sm"
                  leading="loose"
                  color={index() === active ? "primary" : "dimmed"}
                  weight={index() === active ? "semibold" : "regular"}
                >
                  {(index() + offset).toString()}
                </Text>
              </FrameContextNumber>
              <Text
                pre
                code
                break
                on="surface"
                size="mono_sm"
                leading="loose"
                weight={index() === active ? "medium" : "regular"}
                color={index() === active ? "primary" : "secondary"}
              >
                {line.substring(minLeadingSpaces)}
              </Text>
            </FrameContextRow>
          )}
        </For>
      </FrameContext>
    );
  }

  return (
    <For each={props.stack}>
      {(frame, index) => {
        const [expand, setExpand] = createSignal(Boolean(index() === first()));
        return (
          // If raw, remove empty lines
          <Show
            when={
              frame.raw === undefined ||
              (frame.raw !== undefined && frame.raw.trim() !== "")
            }
          >
            <Frame>
              <FrameInfo
                dimmed={
                  !frame.context && anyContext()
                    ? "2"
                    : !frame.important && anyContext()
                      ? "1"
                      : undefined
                }
                onClick={() => {
                  if (!frame.context) return;
                  setExpand((x) => !x);
                }}
              >
                <Show
                  when={frame.context}
                  fallback={
                    anyContext() && <IconChevronRight width="12" height="12" />
                  }
                >
                  <FrameExpand>
                    <Show
                      when={expand()}
                      fallback={<IconChevronRight width="12" height="12" />}
                    >
                      <IconChevronDown width="12" height="12" />
                    </Show>
                  </FrameExpand>
                </Show>
                <FrameTitle>
                  <Show when={frame.raw}>
                    <Text
                      code
                      break
                      on="surface"
                      color="primary"
                      size="mono_sm"
                      leading="normal"
                    >
                      {frame.raw?.replace(/at /g, "").trim()}
                    </Text>
                  </Show>
                  <Show when={!frame.raw}>
                    <Show when={frame.fn}>
                      <Text
                        code
                        on="surface"
                        size="mono_sm"
                        color="primary"
                        leading="normal"
                        weight={expand() ? "semibold" : undefined}
                      >
                        {frame.fn!}
                      </Text>
                      <SpanSpacer space="3" />
                    </Show>
                    <Text
                      code
                      break
                      on="surface"
                      size="mono_sm"
                      color="primary"
                      leading="normal"
                      weight={
                        frame.fn
                          ? expand()
                            ? "medium"
                            : undefined
                          : expand()
                            ? "semibold"
                            : undefined
                      }
                    >
                      {frame.file!}
                    </Text>
                    <SpanSpacer space="2" />
                    <Text
                      code
                      leading="normal"
                      on="surface"
                      color="secondary"
                      size="mono_sm"
                    >
                      {frame.line!}
                      <Text
                        code
                        leading="normal"
                        on="surface"
                        color="dimmed"
                        size="mono_sm"
                      >
                        :
                      </Text>
                      {frame.column!}
                    </Text>
                  </Show>
                </FrameTitle>
              </FrameInfo>
              <Show when={frame.context && expand()}>
                {renderStacktraceFrameContext(frame.line!, frame.context!)}
              </Show>
            </Frame>
          </Show>
        );
      }}
    </For>
  );
}
