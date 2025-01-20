import { styled } from "@macaron-css/solid";
import { Row, Stack } from "$/ui/layout";
import { IconCheck, IconNoSymbol, IconExclamationTriangle } from "$/ui/icons";
import { inputFocusStyles, SplitOptions, SplitOptionsOption } from "$/ui/form";
import { IconCaretRight, IconSubRight } from "$/ui/icons/custom";
import { formatSinceTime, parseTime } from "$/common/format";
import { A, useSearchParams } from "@solidjs/router";
import { theme } from "$/ui/theme";
import type { Issue } from "@console/core/issue";
import {
  For,
  Show,
  Switch,
  Match,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import { useIssuesContext, useStageContext } from "../context";
import { useReplicache } from "$/providers/replicache";
import { HeaderSlot } from "../../header";
import { DateTime, Interval } from "luxon";
import { filter, fromEntries, pipe, sortBy } from "remeda";
import { WarningStore } from "$/data/warning";
import { IssueCountStore } from "$/data/issue";
import { useCommandBar } from "../../command-bar";
import {
  KeyboardNavigator,
  createKeyboardNavigator,
  useKeyboardNavigator,
} from "$/common/keyboard-navigator";
import { ButtonGroup } from "$/ui/button";
import { Histogram } from "$/ui/histogram";
import { utility } from "$/ui/utility";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";
import { useWorkspace } from "../../context";

const COL_COUNT_WIDTH = 260;
const COL_TIME_WIDTH = 140;

const Content = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const Warning = styled("div", {
  base: {
    ...utility.stack(3),
    padding: theme.space[3],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
  },
});

const WarningIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 16,
    height: 16,
    opacity: theme.iconOpacity,
    color: theme.color.text.danger.surface,
  },
});

const WarningText = styled("div", {
  base: {
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.danger.surface,
  },
});

const WarningMoreButton = styled("button", {
  base: {
    textDecoration: "underline",
  },
});

const WarningDetails = styled("div", {
  base: {
    ...utility.stack(4),
    borderStyle: "solid",
    borderWidth: "1px 0 0 0",
    paddingTop: theme.space[3],
    borderColor: theme.color.divider.surface,
  },
});

const WarningDetailsScroll = styled("div", {
  base: {
    ...utility.stack(3),
    overflowY: "auto",
    maxHeight: 170,
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
  },
});

const WarningDetailsTitle = styled("div", {
  base: {
    color: theme.color.text.primary.surface,
  },
});

const WarningDetailsDesc = styled("ul", {
  base: {
    ...utility.text.pre,
    paddingLeft: theme.space[5],
    color: theme.color.text.secondary.surface,
  },
});

const IssuesHeader = styled("div", {
  base: {
    ...utility.row(4),
    height: 54,
    alignItems: "center",
    padding: theme.space[4],
    border: `1px solid ${theme.color.divider.base}`,
    backgroundColor: theme.color.background.surface,
    borderRadius: `${theme.borderRadius} ${theme.borderRadius} 0 0`,
  },
});

const IssueCol = styled("div", {
  base: {
    minWidth: 0,
  },
  variants: {
    grow: {
      true: {
        flex: "1 1 auto",
      },
      false: {
        flex: "0 0 auto",
      },
    },
    align: {
      left: {
        textAlign: "left",
        justifyContent: "flex-start",
      },
      right: {
        textAlign: "right",
        justifyContent: "flex-end",
      },
    },
  },
  defaultVariants: {
    grow: false,
    align: "left",
  },
});

const IssuesHeaderCol = styled(IssueCol, {
  base: {
    ...utility.row(3.5),
    alignItems: "center",
  },
});

const ButtonIcon = styled("span", {
  base: {
    width: 12,
    height: 12,
    marginRight: 6,
    verticalAlign: -2,
    display: "inline-block",
    opacity: theme.iconOpacity,
  },
});

const EmptyIssuesSign = styled("div", {
  base: {
    ...utility.stack(0),
    alignItems: "center",
    justifyContent: "center",
    height: 300,
    padding: `0 ${theme.space[4]}`,
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
  },
});

const EmptyIssuesHelper = styled("div", {
  base: {
    ...utility.stack(5),
    color: theme.color.text.dimmed.base,
  },
});

const EmptyIssuesHelperHeader = styled("span", {
  base: {
    textAlign: "center",
    marginLeft: theme.space[3.5],
    marginRight: theme.space[3.5],
    paddingBottom: theme.space[5],
    borderBottom: `2px dashed ${theme.color.divider.base}`,
    fontSize: theme.font.size.lg,
  },
});

const EmptyIssuesHint = styled("ul", {
  base: {
    ...utility.stack(3),
    paddingLeft: 30,
    listStyle: "circle",
    fontSize: theme.font.size.base,
  },
});

const EmptyIssuesHintCode = styled("span", {
  base: {
    fontSize: theme.font.size.mono_base,
    fontFamily: theme.font.family.code,
  },
});

const EmptyIssuesCopy = styled("span", {
  base: {
    fontSize: theme.font.size.lg,
    color: theme.color.text.dimmed.base,
  },
});

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralize(s: string, count: number) {
  return count === 1 ? s : s + "s";
}

export function List() {
  const bar = useCommandBar();
  bar.register("issues-list", async () => {
    return ["active", "ignored", "resolved"].map((view) => ({
      icon: IconSubRight,
      title: `${capitalize(view)} issues`,
      run: (control) => {
        setSearch({
          view: view,
        });
        control.hide();
      },
      disabled: search.view === view,
      category: "Issues",
    }));
  });
  bar.register("issues-bulk", async () => {
    return [
      {
        icon: IconCaretRight,
        title: `Resolve ${selected().length} ${pluralize(
          "issue",
          selected().length,
        )}`,
        run: (control) => {
          rep().mutate.issue_resolve(selected());
          reset();
          control.hide();
        },
        disabled:
          selected().length === 0 || (search.view && search.view !== "active"),
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: `Reopen ${selected().length} ${pluralize(
          "issue",
          selected().length,
        )}`,
        run: (control) => {
          rep().mutate.issue_unresolve(selected());
          reset();
          control.hide();
        },
        disabled: selected().length === 0 || search.view !== "resolved",
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: `Ignore ${selected().length} ${pluralize(
          "issue",
          selected().length,
        )}`,
        run: (control) => {
          rep().mutate.issue_ignore(selected());
          reset();
          control.hide();
        },
        disabled:
          selected().length === 0 || (search.view && search.view !== "active"),
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: `Reopen ${selected().length} ${pluralize(
          "issue",
          selected().length,
        )}`,
        run: (control) => {
          rep().mutate.issue_unignore(selected());
          reset();
          control.hide();
        },
        disabled: selected().length === 0 || search.view !== "ignored",
        category: "Issues",
      },
      {
        icon: IconCaretRight,
        title: "Select all issues",
        run: (control) => {
          document
            .querySelector<HTMLInputElement>("input[name='select-all']")
            ?.click();
          control.hide();
        },
        category: "Issues",
      },
    ];
  });
  const navigator = createKeyboardNavigator({
    target: "[data-element='issue']",
    onSelect: (el) => (el.querySelector("a") as HTMLElement).click(),
    onPeek: (el, event) => {
      if (event === "open") {
        el.querySelector("input")?.click();
      }
    },
  });

  const issues = useIssuesContext();
  const [search, setSearch] = useSearchParams<{
    view: "active" | "ignored" | "resolved";
  }>();
  const view = createMemo(() => search.view || "active");
  const rep = useReplicache();
  const filtered = createMemo(() =>
    pipe(
      issues(),
      filter((item) => {
        if (view() === "active") return !item.timeResolved && !item.timeIgnored;
        if (view() === "ignored") return Boolean(item.timeIgnored);
        if (view() === "resolved") return Boolean(item.timeResolved);
        return false;
      }),
      sortBy([(item) => item.timeSeen, "desc"]),
    ),
  );

  const stage = useStageContext();
  const workspace = useWorkspace();

  const subWarnings = WarningStore.forStage.watch(
    rep,
    () => [stage.stage.id],
    (warnings) =>
      warnings.filter((warning) => warning.type === "log_subscription"),
  );
  const rateWarnings = WarningStore.forStage.watch(
    rep,
    () => [stage.stage.id],
    (warnings) =>
      warnings.filter((warning) => warning.type === "issue_rate_limited"),
  );

  const infraWarnings = WarningStore.forStage.watch(
    rep,
    () => [stage.stage.id],
    (warnings) =>
      warnings.filter((warning) => warning.type === "issue_infra"),
  );


  const [selected, setSelected] = createSignal<string[]>([]);
  const [warningExpanded, setWarningExpanded] = createSignal(false);
  let form!: HTMLFormElement;

  function reset() {
    form.reset();
    setSelected([]);
  }

  createEffect(() => {
    view();
    reset();
  });

  function renderWarning() {
    return (
      <Warning>
        <Row space="4" vertical="center" horizontal="between">
          <Row flex space="2.5" vertical="center">
            <WarningIcon>
              <IconExclamationTriangle />
            </WarningIcon>
            <WarningText>
              <Switch>
                <Match when={infraWarnings().length > 0}>
                  The console now processes issues inside your own account - however we could not automatically create this infrastructure for you. You can fix the permissions of the SSTConsole iam role or manually create the cloudformation stack.{" "}
                </Match>
                <Match when={rateWarnings().length > 0}>
                  You hit a rate limit for some of your functions. You can
                  re-enable them or contact us to have the limit lifted.{" "}
                </Match>
                <Match when={subWarnings().length > 0}>
                  There was a problem enabling Issues for some of your
                  functions.{" "}
                </Match>
              </Switch>
              <WarningMoreButton
                onClick={() => setWarningExpanded(!warningExpanded())}
              >
                <Show when={!warningExpanded() && !infraWarnings().length} fallback="Hide details">
                  Show details
                </Show>
              </WarningMoreButton>
              .
            </WarningText>
          </Row>
          <Button
            size="sm"
            color="secondary"
            onClick={() => {
              rep().mutate.issue_subscribe({
                stageID: stage.stage.id,
              });
            }}
          >
            {rateWarnings().length > 0 ? "Enable" : "Retry"}
          </Button>
        </Row>
        <Show when={warningExpanded() || infraWarnings().length > 0}>
          <WarningDetails>
            <WarningDetailsScroll>
              <Show when={rateWarnings().length > 0}>
                <Stack space="1">
                  <WarningDetailsTitle>
                    These functions hit a soft limit for the number of issues
                    per hour. You can re-enable them, or{" "}
                    <a href="mailto:help@sst.dev">
                      contact us to lift the limit.
                    </a>
                  </WarningDetailsTitle>
                  <WarningDetailsDesc>
                    <For
                      each={rateWarnings()
                        .map((item) => {
                          if (item.type === "issue_rate_limited") {
                            return item.target;
                          }
                        })
                        .filter(Boolean)}
                    >
                      {(item) => <li>{item}</li>}
                    </For>
                  </WarningDetailsDesc>
                </Stack>
              </Show>
              <Show when={subWarnings().length > 0}>
                <Stack space="1">
                  <WarningDetailsTitle>
                    We could not enable Issues for these functions. You can fix
                    the problem and try again. Or,{" "}
                    <a href="mailto:help@sst.dev">
                      contact us if you need help.
                    </a>
                  </WarningDetailsTitle>
                  <WarningDetailsDesc>
                    <For
                      each={subWarnings()
                        .map((item) => {
                          if (item.type === "log_subscription") {
                            const reason = (function () {
                              switch (item.data.error) {
                                case "unknown":
                                  return "Unknown error: " + item.data.message;
                                case "limited":
                                  return "Too many existing log subscribers";
                                case "permissions":
                                  return "Missing permissions to add log subscriber";
                                default:
                                  return "Unknown";
                              }
                            })();
                            return `${item.target}: ${reason}`;
                          }
                        })
                        .filter(Boolean)}
                    >
                      {(item) => <li>{item}</li>}
                    </For>
                  </WarningDetailsDesc>
                </Stack>
              </Show>
              <Show when={infraWarnings().length > 0}>
                <Stack space="1">
                  <WarningDetailsTitle>
                    There was trouble creating issue processing infra in the following regions:
                  </WarningDetailsTitle>
                  <WarningDetailsDesc>
                    <For
                      each={infraWarnings()}
                    >
                      {(item) => <li>{item.target} - <a
                        target="_blank"
                        href={`https://${item.target}.console.aws.amazon.com/cloudformation/home?region=${item.target}#/stacks/quickcreate?region=${item.target}&param_workspaceID=${workspace().id}&param_template=${import.meta.env.VITE_ISSUES_URL}&stackName=sst-console-issue-${workspace().id}&templateURL=${import.meta.env.VITE_ISSUES_URL
                          }`}
                      >Create cloudformation stack</a></li>}
                    </For>
                  </WarningDetailsDesc>
                </Stack>
              </Show>
            </WarningDetailsScroll>
          </WarningDetails>
        </Show>
      </Warning >
    );
  }

  return (
    <>
      <HeaderSlot>
        <SplitOptions size="sm">
          <SplitOptionsOption
            onClick={() => setSearch({ view: "active" })}
            selected={view() === "active"}
          >
            Active
          </SplitOptionsOption>
          <SplitOptionsOption
            onClick={() => setSearch({ view: "ignored" })}
            selected={view() === "ignored"}
          >
            Ignored
          </SplitOptionsOption>
          <SplitOptionsOption
            onClick={() => setSearch({ view: "resolved" })}
            selected={view() === "resolved"}
          >
            Resolved
          </SplitOptionsOption>
        </SplitOptions>
      </HeaderSlot>
      <Content>
        <Stack space="4">
          <Show when={subWarnings().length > 0 || rateWarnings().length > 0 || infraWarnings().length > 0}>
            {renderWarning()}
          </Show>
          <form
            ref={form}
            onSubmit={(e) => e.preventDefault()}
            onChange={(e) => {
              const issues = [
                ...e.currentTarget.querySelectorAll<HTMLInputElement>(
                  "input[name='issue']:checked",
                ),
              ].map((i) => i.value);
              setSelected(issues);
            }}
          >
            <IssuesHeader>
              <IssuesHeaderCol>
                <IssueCheckbox
                  name="select-all"
                  onChange={(e) => {
                    for (const input of form.querySelectorAll<HTMLInputElement>(
                      "input[type='checkbox']",
                    )) {
                      input.checked = e.currentTarget.checked;
                    }
                  }}
                  type="checkbox"
                />
              </IssuesHeaderCol>
              <IssuesHeaderCol grow>
                <Text
                  code
                  uppercase
                  on="surface"
                  size="mono_sm"
                  weight="medium"
                  color="dimmed"
                >
                  Error
                </Text>
                <Show when={selected().length > 0}>
                  <Show
                    when={
                      search.view !== "ignored" && search.view !== "resolved"
                    }
                    fallback={
                      <Button
                        size="sm"
                        color="secondary"
                        onClick={() => {
                          search.view === "ignored"
                            ? rep().mutate.issue_unignore(selected())
                            : rep().mutate.issue_unresolve(selected());
                          reset();
                        }}
                      >
                        Reopen Issue
                      </Button>
                    }
                  >
                    <ButtonGroup>
                      <Button
                        active={search.view === "ignored"}
                        onClick={() => {
                          search.view === "ignored"
                            ? rep().mutate.issue_unignore(selected())
                            : rep().mutate.issue_ignore(selected());
                          reset();
                        }}
                        size="sm"
                        grouped="left"
                        color="secondary"
                      >
                        <ButtonIcon>
                          <IconNoSymbol />
                        </ButtonIcon>
                        Ignore
                      </Button>
                      <Button
                        active={search.view === "resolved"}
                        onClick={() => {
                          search.view === "resolved"
                            ? rep().mutate.issue_unresolve(selected())
                            : rep().mutate.issue_resolve(selected());
                          reset();
                        }}
                        size="sm"
                        grouped="right"
                        color="secondary"
                      >
                        <ButtonIcon>
                          <IconCheck />
                        </ButtonIcon>
                        Resolve
                      </Button>
                    </ButtonGroup>
                  </Show>
                </Show>
              </IssuesHeaderCol>
              <IssuesHeaderCol
                align="right"
                style={{ width: `${COL_COUNT_WIDTH}px` }}
                title="Events in the last 24 hours"
              >
                <Text
                  code
                  uppercase
                  on="surface"
                  size="mono_sm"
                  color="dimmed"
                  weight="medium"
                >
                  Last 24hrs
                </Text>
              </IssuesHeaderCol>
              <IssuesHeaderCol
                align="right"
                style={{ width: `${COL_TIME_WIDTH}px` }}
                title="Latest occurrence of the error"
              >
                <Text
                  code
                  uppercase
                  on="surface"
                  color="dimmed"
                  size="mono_sm"
                  weight="medium"
                >
                  Time
                </Text>
              </IssuesHeaderCol>
            </IssuesHeader>
            <div>
              <Show
                when={filtered().length !== 0}
                fallback={
                  <EmptyIssuesSign>
                    <Switch>
                      <Match
                        when={view() === "active" && issues().length === 0}
                      >
                        <EmptyIssuesHelper>
                          <EmptyIssuesHelperHeader>
                            Reporting Issues
                          </EmptyIssuesHelperHeader>
                          <EmptyIssuesHint>
                            <li>
                              Simply call{" "}
                              <EmptyIssuesHintCode>
                                `console.error(new Error("MyError"))`
                              </EmptyIssuesHintCode>
                            </li>
                            <li>
                              Function failures and timeouts are automatically
                              detected
                            </li>
                          </EmptyIssuesHint>
                        </EmptyIssuesHelper>
                      </Match>
                      <Match when={view() === "active" && issues().length > 0}>
                        <EmptyIssuesCopy>No new issues</EmptyIssuesCopy>
                      </Match>
                      <Match when={view() === "ignored"}>
                        <EmptyIssuesCopy>No ignored issues</EmptyIssuesCopy>
                      </Match>
                      <Match when={view() === "resolved"}>
                        <EmptyIssuesCopy>No resolved issues</EmptyIssuesCopy>
                      </Match>
                    </Switch>
                  </EmptyIssuesSign>
                }
              >
                <KeyboardNavigator value={navigator}>
                  <For each={filtered()}>
                    {(issue, i) => {
                      return (
                        <IssueRow
                          issue={issue}
                          unread={view() === "active"}
                          last={i() === filtered().length - 1}
                          logName={issue.pointer?.logGroup || ""}
                        />
                      );
                    }}
                  </For>
                </KeyboardNavigator>
              </Show>
            </div>
          </form>
        </Stack>
      </Content>
    </>
  );
}

const IssueRoot = styled("div", {
  base: {
    ...utility.row(4),
    padding: theme.space[4],
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    position: "relative",
    ":last-child": {
      borderRadius: `0 0 ${theme.borderRadius} ${theme.borderRadius}`,
    },
    selectors: {
      "&[data-focus='true']": {
        ...inputFocusStyles,
        outlineOffset: -1,
      },
    },
  },
});

const BlockLink = styled(A, {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

const IssueError = styled(A, {
  base: {
    zIndex: 2,
    overflow: "hidden",
    lineHeight: "normal",
    whiteSpace: "nowrap",
    cursor: "pointer",
    textOverflow: "ellipsis",
    color: theme.color.text.primary.base,
  },
  variants: {
    weight: {
      regular: {
        fontWeight: 400,
      },
      medium: {
        fontWeight: 500,
      },
      semibold: {
        fontWeight: 600,
      },
    },
  },
  defaultVariants: {
    weight: "regular",
  },
});

const IssueCheckbox = styled("input", {
  base: {
    flex: "0 0 auto",
    zIndex: 2,
    cursor: "pointer",
  },
});

type IssueProps = {
  last: boolean;
  logName: string;
  unread: boolean;
  issue: Issue.Info;
  focus?: boolean;
};

function IssueRow(props: IssueProps) {
  const rep = useReplicache();
  const min = DateTime.now()
    .startOf("hour")
    .minus({ hours: 24 })
    .toSQL({ includeOffset: false })!;

  const counts = IssueCountStore.forIssue.watch(
    rep,
    () => [props.issue.group],
    (items) => items.filter((item) => item.hour > min),
  );
  const histogram = createMemo(() => {
    const hours = fromEntries(
      counts().map((item) => [
        parseTime(item.hour).toSQL({ includeOffset: false })!,
        item.count,
      ]),
    );
    return Interval.fromDateTimes(
      DateTime.now().toUTC().startOf("hour").minus({ hours: 23 }),
      DateTime.now().toUTC().startOf("hour").plus({ hours: 1 }),
    )
      .splitBy({ hours: 1 })
      .map((interval) => interval.start!.toSQL({ includeOffset: false })!)
      .map((hour) => ({ label: hour, value: hours[hour] || 0 }));
  });

  const navigator = useKeyboardNavigator();

  return (
    <IssueRoot data-element="issue" data-focus={props.focus ? true : undefined}>
      <BlockLink href={props.issue.id}></BlockLink>
      <IssueCheckbox
        name="issue"
        type="checkbox"
        value={props.issue.id}
        onClick={(e) => {
          navigator?.focus(e.currentTarget);
          e.stopPropagation();
        }}
      />
      <IssueCol grow>
        <Stack space="2">
          <Row horizontal="start">
            <IssueError
              href={props.issue.id}
              weight={props.unread ? "medium" : "regular"}
            >
              {props.issue.error}
            </IssueError>
          </Row>
          <Stack space="1">
            <Text line size="sm" leading="normal">
              {props.issue.message}
            </Text>

            <Text code line leading="normal" size="mono_sm" color="dimmed">
              {props.logName}
            </Text>
          </Stack>
        </Stack>
      </IssueCol>
      <IssueCol align="right" style={{ width: `${COL_COUNT_WIDTH}px` }}>
        <Histogram
          height={30}
          units="Errors"
          data={histogram()}
          width={COL_COUNT_WIDTH}
          currentTime={Date.now()}
          tooltipAlignment={props.last ? "top" : "bottom"}
        />
      </IssueCol>
      <IssueCol align="right" style={{ width: `${COL_TIME_WIDTH}px` }}>
        <Text
          line
          size="sm"
          color="dimmed"
          leading="normal"
          title={parseTime(props.issue.timeSeen).toLocaleString(
            DateTime.DATETIME_FULL,
          )}
        >
          {formatSinceTime(props.issue.timeSeen)}
        </Text>
      </IssueCol>
    </IssueRoot>
  );
}
