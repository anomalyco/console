import {
  For,
  Match,
  Show,
  Switch,
  createComputed,
  createSignal,
  createMemo,
} from "solid-js";
import { utility } from "$/ui/utility";
import { Dropdown } from "$/ui/dropdown";
import {
  IconEnvelopeSolid,
  IconArrowLongRight,
  IconEllipsisVertical,
  IconEllipsisHorizontal,
  IconExclamationTriangle,
} from "$/ui/icons";
import { IconLogosSlackBW } from "$/ui/icons/custom";
import { createSubscription, useReplicache } from "$/providers/replicache";
import { AppStore, AlertStore, SlackTeamStore } from "$/data/app";
import { Alert } from "@console/core/alert";
import { createStore, unwrap } from "solid-js/store";
import { MultiSelect, Select } from "$/ui/select";
import { UserStore } from "$/data/user";
import { ActiveStages } from "$/data/stage";
import { filter, map, pipe, unique } from "remeda";
import { createId } from "@paralleldrive/cuid2";
import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import { array, literal, object, string, union, minLength } from "valibot";
import {
  reset,
  validate,
  valiForm,
  setValue,
  toCustom,
  getValue,
  setValues,
  getErrors,
  getValues,
  createForm,
} from "@modular-forms/solid";
import { WarningStore } from "$/data/warning";
import { LinkButton } from "$/ui/button";
import { FormField, Input } from "$/ui/form";
import { Stack, Row, Grower } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";

const PANEL_CONTENT_SPACE = "10";
const PANEL_HEADER_SPACE = "3";

const AlertsPanel = styled("div", {
  base: {
    border: `1px solid ${theme.color.divider.base}`,
    borderRadius: theme.borderRadius,
  },
});

const AlertsPanelRow = styled("div", {
  base: {
    alignItems: "center",
    padding: `${theme.space[4]} ${theme.space[5]}`,
    borderBottom: `1px solid ${theme.color.divider.base}`,
    selectors: {
      "&:last-child": {
        borderBottom: "none",
      },
    },
  },
  variants: {
    new: {
      true: {
        ...utility.row(3),
        justifyContent: "flex-start",
      },
      false: {
        ...utility.row(8),
        justifyContent: "space-between",
      },
    },
  },
  defaultVariants: {
    new: false,
  },
});

const alertsPanelRowTitleEditing = style({
  opacity: 0.6,
});

const alertsPanelRowEditing = style({
  padding: theme.space[6],
  backgroundColor: theme.color.background.surface,
  borderBottom: `1px solid ${theme.color.divider.surface}`,
  selectors: {
    "&:last-child": {
      borderBottom: "none",
    },
  },
});

const AlertsPanelEditingLabel = styled("span", {
  base: {
    ...utility.text.label,
    color: theme.color.text.primary.surface,
    fontSize: theme.font.size.mono_sm,
  },
});

const AlertsPanelEditingDesc = styled("span", {
  base: {
    color: theme.color.text.dimmed.surface,
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
  },
});

const AlertsPanelRowEditingField = styled("div", {
  base: {
    ...utility.row(4),
    alignItems: "flex-start",
    justifyContent: "center",
    padding: `${theme.space[5]} 0`,
    borderBottom: `1px solid ${theme.color.divider.surface}`,
    selectors: {
      "&:first-child": {
        paddingTop: 0,
      },
    },
  },
});

const AlertsPanelRowSource = styled("div", {
  base: {
    ...utility.stack(3),
    flex: "1 1 auto",
    minWidth: 0,
  },
});

const alertsPanelRowEditingDropdown = style({
  flex: 1,
});

const MatchingStagesPanelRoot = styled("div", {
  base: {
    ...utility.stack(3),
    alignItems: "stretch",
  },
});

const MatchingStagesPanelStatus = styled("span", {
  base: {
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

const MatchingStagesMoreButton = styled("button", {
  base: {
    textDecoration: "underline",
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

const MatchingStagesPanelExpanded = styled("div", {
  base: {
    paddingTop: theme.space[2],
    borderTop: `1px solid ${theme.color.divider.surface}`,
  },
});

const MatchingStagesCopy = styled("span", {
  base: {
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.secondary.surface,
  },
});

const AlertsPanelRowIcon = styled("div", {
  base: {
    marginTop: theme.space[1],
    opacity: theme.iconOpacity,
    color: theme.color.text.secondary.base,
  },
  variants: {
    dimmed: {
      true: {
        color: theme.color.text.dimmed.base,
      },
      false: {},
    },
  },
  defaultVariants: {
    dimmed: false,
  },
});

const AlertsPanelToIcon = styled("div", {
  base: {
    opacity: theme.iconOpacity,
    lineHeight: `calc(${theme.font.lineHeight} * ${theme.font.size.sm})`,
    color: theme.color.text.secondary.base,
  },
  variants: {
    error: {
      true: {
        color: theme.color.text.danger.base,
      },
      false: {},
    },
  },
});

const AlertsPanelToLabel = styled("span", {
  base: {
    wordBreak: "break-all",
    fontSize: theme.font.size.sm,
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.secondary.base,
  },
  variants: {
    error: {
      true: {
        color: theme.color.text.danger.base,
      },
      false: {},
    },
  },
});

const AlertsPanelRowFromLabel = styled("div", {
  base: {
    lineHeight: theme.font.lineHeight,
    color: theme.color.text.secondary.base,
  },
});

const AlertsPanelFromKeyword = styled("span", {
  base: {
    wordBreak: "break-all",
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.primary.base,
  },
});

const AlertsPanelRowEditingFieldLabel = styled("div", {
  base: {
    ...utility.stack(1.5),
    flex: "0 0 auto",
    width: 240,
  },
});

function joinWithAnd(arr: string[]): string {
  const length = arr.length;

  if (length === 0) {
    return "";
  }

  if (length === 1) {
    return arr[0];
  }

  if (length === 2) {
    return `${arr[0]} and ${arr[1]}`;
  }

  const allButLast = arr.slice(0, length - 1).join(", ");
  return `${allButLast}, and ${arr[length - 1]}`;
}

const PutForm = object({
  destination: object({
    type: union([literal("email"), literal("slack")], "Must select channel"),
    email: object({
      users: array(string(), [minLength(1)]),
    }),
    slack: object({
      channel: string([minLength(1, "Slack channel is required")]),
    }),
  }),
  source: object({
    app: array(string(), [minLength(1, "Must select at least one app")]),
    stage: string([minLength(1)]),
  }),
  event: union(
    [literal("issue"), literal("autodeploy"), literal("autodeploy.error")],
    "Must select event",
  ),
});

export function Alerts() {
  const rep = useReplicache();
  const users = createSubscription(
    async (tx) => UserStore.list(tx).then(filter((u) => !u.timeDeleted)),
    [],
  );
  const alerts = createSubscription(async (tx) => {
    const ret = AlertStore.all(tx);
    return ret;
  }, []);

  const [putForm, { Form, Field }] = createForm({
    validate: valiForm(PutForm),
  });
  const [editing, setEditing] = createStore<{
    id?: string;
    active: boolean;
  }>({
    active: false,
  });

  const apps = AppStore.all.watch(rep, () => []);
  const activeStages = createSubscription(ActiveStages());
  const stages = createMemo(() => activeStages.value || []);
  // const stages = StageStore.list.watch(rep, () => []);
  const selectedApps = createMemo(() =>
    apps()
      .filter((app) => {
        const formData = getValues(putForm);
        return (
          formData.source?.app?.includes("*") ||
          formData.source?.app?.includes(app.name)
        );
      })
      .map((app) => app.id),
  );

  const availableStages = createMemo(() => {
    return pipe(
      stages(),
      filter((s) => selectedApps().includes(s.appID)),
      map((s) => s.name),
      unique(),
    );
  });

  const matchingStages = createMemo(() => {
    const stageFilter = getValue(putForm, "source.stage");
    const result = [];
    for (const app of apps()) {
      if (!selectedApps().includes(app.id)) continue;
      for (const stage of stages()) {
        if (stage.appID !== app.id) continue;
        if (stageFilter !== "*" && stageFilter !== stage.name) continue;
        result.push({ app: app.name, stage: stage.name });
      }
    }
    return result;
  });

  function createAlert() {
    reset(putForm);
    setValues(putForm, {
      source: {},
      destination: {},
      event: undefined,
    });
    setEditing("active", true);
    setEditing("id", undefined);
  }

  function editAlert(alert: Alert.Info, clone?: boolean) {
    reset(putForm);
    alert = structuredClone(unwrap(alert));

    // @ts-expect-error
    setValues(putForm, {
      source: {
        app: alert.source.app === "*" ? ["*"] : alert.source.app,
        stage: alert.source.stage === "*" ? "*" : alert.source.stage[0],
      },
      destination: {
        type: alert.destination.type,
        email: {
          users:
            alert.destination.type === "email"
              ? alert.destination.properties.users
              : [],
        },
        slack: {
          channel:
            alert.destination.type === "slack"
              ? alert.destination.properties.channel
              : undefined,
        },
      },
      event: alert.event,
    });
    setEditing("active", true);
    setEditing("id", clone ? undefined : alert.id);
  }

  const MatchingStagesPanel = () => {
    const [expanded, setExpanded] = createSignal(false);
    return (
      <MatchingStagesPanelRoot>
        <div>
          <MatchingStagesPanelStatus>
            <Switch>
              <Match when={matchingStages().length === 0}>
                Does not match any stages.
              </Match>
              <Match when={matchingStages().length === 1}>
                Matches 1 stage.{" "}
              </Match>
              <Match when={true}>
                Matches {matchingStages().length} stages.{" "}
              </Match>
            </Switch>
          </MatchingStagesPanelStatus>
          <Show when={matchingStages().length > 0}>
            <MatchingStagesMoreButton onClick={() => setExpanded(!expanded())}>
              <Show when={!expanded()} fallback="Hide">
                <Switch>
                  <Match when={matchingStages().length === 1}>Show</Match>
                  <Match when={true}>Show all</Match>
                </Switch>
              </Show>
            </MatchingStagesMoreButton>
          </Show>
        </div>
        <Show when={expanded()}>
          <MatchingStagesPanelExpanded>
            <MatchingStagesCopy>
              {joinWithAnd(
                matchingStages().map(({ app, stage }) => `${app}/${stage}`),
              )}
            </MatchingStagesCopy>
          </MatchingStagesPanelExpanded>
        </Show>
      </MatchingStagesPanelRoot>
    );
  };

  const AlertsEditor = () => (
    <Form
      onError={console.log}
      onSubmit={(e) => {
        console.log("submit", e);
      }}
      class={alertsPanelRowEditing}
    >
      <Stack space="6">
        <Stack>
          <AlertsPanelRowEditingField>
            <AlertsPanelRowEditingFieldLabel>
              <AlertsPanelEditingLabel>Channel</AlertsPanelEditingLabel>
              <AlertsPanelEditingDesc>
                The channel to use for sending the alerts.
              </AlertsPanelEditingDesc>
            </AlertsPanelRowEditingFieldLabel>
            <Row flex space="4" vertical="start">
              <Field name="destination.type">
                {(field, props) => (
                  <FormField
                    class={alertsPanelRowEditingDropdown}
                    color={field.error ? "danger" : "primary"}
                    hint={
                      getValue(putForm, "destination.type") === "slack" &&
                      !slackTeam() ? (
                        <span>
                          <a href="#slack">Connect your Slack</a> workspace{" "}
                          below.
                        </span>
                      ) : undefined
                    }
                  >
                    <Select
                      {...props}
                      value={field.value}
                      error={field.error}
                      options={[
                        {
                          value: "slack",
                          label: "Slack",
                        },
                        {
                          value: "email",
                          label: "Email",
                        },
                      ]}
                    />
                  </FormField>
                )}
              </Field>
              <Grower />
            </Row>
          </AlertsPanelRowEditingField>
          <AlertsPanelRowEditingField>
            <AlertsPanelRowEditingFieldLabel>
              <AlertsPanelEditingLabel>Source</AlertsPanelEditingLabel>
              <AlertsPanelEditingDesc>
                The apps and stages that'll be sending the alerts.
              </AlertsPanelEditingDesc>
            </AlertsPanelRowEditingFieldLabel>
            <AlertsPanelRowSource>
              <Row space="4" vertical="start">
                <Field type="string[]" name="source.app">
                  {(field, props) => {
                    const value = createMemo((prev: string[]) => {
                      const next = field.value || [];
                      if (next[0] === "") return [];
                      if (!prev.includes("*") && next.includes("*")) {
                        return ["*"];
                      }
                      if (prev.includes("*") && next.length > 1) {
                        return next.filter((v) => v !== "*");
                      }
                      return next;
                    }, []);

                    createComputed(() =>
                      setValue(putForm, "source.app", value()),
                    );

                    return (
                      <FormField
                        label="App"
                        class={alertsPanelRowEditingDropdown}
                        color={field.error ? "danger" : "primary"}
                      >
                        <MultiSelect
                          {...props}
                          required
                          error={field.error}
                          value={field.value}
                          options={[
                            {
                              label: "All apps",
                              value: "*",
                              seperator: true,
                            },
                            ...apps().map((app) => ({
                              label: app.name,
                              value: app.name,
                            })),
                          ]}
                        />
                      </FormField>
                    );
                  }}
                </Field>
                <Field name="source.stage">
                  {(field, props) => (
                    <FormField
                      label="Stages"
                      class={alertsPanelRowEditingDropdown}
                      color={
                        field.error && getValue(putForm, "source.app")?.length
                          ? "danger"
                          : "primary"
                      }
                    >
                      <Select
                        {...props}
                        value={field.value}
                        error={field.error}
                        disabled={!getValue(putForm, "source.app")?.length}
                        options={[
                          {
                            label: "All stages",
                            value: "*",
                            seperator: true,
                          },
                          ...availableStages().map((stage) => ({
                            label: stage,
                            value: stage,
                          })),
                        ]}
                      />
                    </FormField>
                  )}
                </Field>
              </Row>
              <Show
                when={
                  getValue(putForm, "source.app")?.length &&
                  getValue(putForm, "source.stage")?.length
                }
              >
                <MatchingStagesPanel />
              </Show>
            </AlertsPanelRowSource>
          </AlertsPanelRowEditingField>
          <AlertsPanelRowEditingField>
            <AlertsPanelRowEditingFieldLabel>
              <AlertsPanelEditingLabel>Destination</AlertsPanelEditingLabel>
              <AlertsPanelEditingDesc>
                Specify who will be getting these alerts.
              </AlertsPanelEditingDesc>
            </AlertsPanelRowEditingFieldLabel>
            <Row flex space="4" vertical="start">
              <Switch>
                <Match when={getValue(putForm, "destination.type") === "email"}>
                  <Field name="destination.email.users" type="string[]">
                    {(field, props) => {
                      const value = createMemo((prev: string[]) => {
                        const next = field.value || [];
                        if (next[0] === "") return [];
                        if (!prev.includes("*") && next.includes("*")) {
                          return ["*"];
                        }
                        if (prev.includes("*") && next.length > 1) {
                          return next.filter((v) => v !== "*");
                        }
                        return next;
                      }, []);

                      createComputed(() =>
                        setValue(putForm, "destination.email.users", value()),
                      );
                      return (
                        <FormField
                          class={alertsPanelRowEditingDropdown}
                          color={field.error ? "danger" : "primary"}
                        >
                          <MultiSelect
                            {...props}
                            error={field.error}
                            value={field.value}
                            options={[
                              {
                                value: "*",
                                label: "All users",
                                seperator: true,
                              },
                              ...users.value.map((user) => ({
                                value: user.id,
                                label: user.email,
                              })),
                            ]}
                          />
                        </FormField>
                      );
                    }}
                  </Field>
                </Match>
                <Match when={getValue(putForm, "destination.type") === "slack"}>
                  <Field
                    name="destination.slack.channel"
                    transform={toCustom(
                      (value) => {
                        if (!value) return "";
                        value = value.trim().toLowerCase();
                        if (value?.startsWith("#")) {
                          return value;
                        }
                        return `#${value}`;
                      },
                      {
                        on: "blur",
                      },
                    )}
                  >
                    {(field, props) => (
                      <FormField
                        class={alertsPanelRowEditingDropdown}
                        color={field.error ? "danger" : "primary"}
                      >
                        <Input
                          {...props}
                          value={field.value}
                          placeholder="#channel"
                        />
                      </FormField>
                    )}
                  </Field>
                </Match>
                <Match when={true}>
                  <FormField class={alertsPanelRowEditingDropdown}>
                    <Input disabled />
                  </FormField>
                </Match>
              </Switch>
              <Grower />
            </Row>
          </AlertsPanelRowEditingField>
          <AlertsPanelRowEditingField>
            <AlertsPanelRowEditingFieldLabel>
              <AlertsPanelEditingLabel>Type</AlertsPanelEditingLabel>
              <AlertsPanelEditingDesc>
                The type of events to get alerted.
              </AlertsPanelEditingDesc>
            </AlertsPanelRowEditingFieldLabel>
            <Row flex space="4" vertical="start">
              <Field name="event">
                {(field, props) => (
                  <FormField
                    class={alertsPanelRowEditingDropdown}
                    color={field.error ? "danger" : "primary"}
                  >
                    <Select
                      {...props}
                      value={field.value}
                      error={field.error}
                      options={[
                        {
                          value: "issue",
                          label: "Issues",
                        },
                        {
                          value: "autodeploy",
                          label: "Autodeploys",
                        },
                        {
                          value: "autodeploy.error",
                          label: "Autodeploy Errors",
                        },
                      ]}
                    />
                  </FormField>
                )}
              </Field>
              <Grower />
            </Row>
          </AlertsPanelRowEditingField>
        </Stack>
        <Row space="4" vertical="center" horizontal="end">
          <LinkButton onClick={() => setEditing("active", false)}>
            Cancel
          </LinkButton>
          <Button
            type="submit"
            onClick={async () => {
              console.log("validate", await validate(putForm));
              const errors = getErrors(putForm);
              console.log("errors", errors);
              const cloned = getValues(putForm);
              console.log("values", cloned);
              if (Object.keys(getErrors(putForm)).length) return;
              await rep().mutate.alert_put({
                id: editing.id || createId(),
                source: {
                  app: cloned.source!.app!.includes("*")
                    ? "*"
                    : cloned.source!.app!,
                  stage:
                    cloned.source?.stage === "*"
                      ? "*"
                      : [cloned.source?.stage!],
                },
                destination:
                  cloned.destination!.type === "slack"
                    ? {
                        type: "slack",
                        properties: {
                          channel: cloned.destination!.slack?.channel!,
                        },
                      }
                    : {
                        type: "email",
                        properties: {
                          users: cloned.destination!.email!.users!.includes("*")
                            ? "*"
                            : cloned.destination!.email!.users!,
                        },
                      },
                event: cloned.event!,
              });
              setEditing("active", false);
            }}
            color={editing.id ? "success" : "primary"}
          >
            <Show when={editing.id} fallback={"Create"}>
              Update
            </Show>
          </Button>
        </Row>
      </Stack>
    </Form>
  );
  const slackWarnings = WarningStore.list.watch(
    rep,
    () => [],
    (warnings) =>
      Object.fromEntries(
        warnings
          .filter((w) => w.type === "issue_alert_slack")
          .map((w) => [w.target, w] as const),
      ),
  );
  const slackTeam = SlackTeamStore.all.watch(
    rep,
    () => [],
    (all) => all.at(0),
  );

  return (
    <>
      <Stack id="alerts" space={PANEL_CONTENT_SPACE}>
        <Stack space={PANEL_HEADER_SPACE}>
          <Text size="lg" weight="medium">
            Alerts
          </Text>
          <Text size="sm" color="dimmed">
            Manage the alerts you want your team to receieve
          </Text>
        </Stack>
        <Show
          when={alerts.value.length !== 0 || editing.active}
          fallback={
            <Row>
              <Button color="secondary" onClick={() => createAlert()}>
                Add Alert
              </Button>
            </Row>
          }
        >
          <AlertsPanel>
            <For each={alerts.value}>
              {(alert) => {
                const isEditingRow = createMemo(
                  () => editing.active && editing.id === alert.id,
                );

                return (
                  <>
                    <AlertsPanelRow>
                      <Row
                        space="3"
                        vertical="start"
                        class={
                          isEditingRow()
                            ? alertsPanelRowTitleEditing
                            : undefined
                        }
                      >
                        <AlertsPanelRowIcon title="Email alert">
                          <Switch>
                            <Match when={alert.destination.type === "email"}>
                              <IconEnvelopeSolid width={17} height={17} />
                            </Match>
                            <Match when={alert.destination.type === "slack"}>
                              <IconLogosSlackBW width={18} height={18} />
                            </Match>
                          </Switch>
                        </AlertsPanelRowIcon>
                        <Stack space="2">
                          <AlertsPanelRowFromLabel>
                            <AlertsPanelFromKeyword>
                              {
                                {
                                  issue: "Issues",
                                  autodeploy: "Autodeploys",
                                  "autodeploy.error": "Autodeploy errors",
                                }[alert.event]
                              }
                            </AlertsPanelFromKeyword>{" "}
                            from{" "}
                            <Show
                              when={alert.source.app !== "*"}
                              fallback={
                                <AlertsPanelFromKeyword>
                                  all apps
                                </AlertsPanelFromKeyword>
                              }
                            >
                              <>
                                <AlertsPanelFromKeyword>
                                  {alert.source.app !== "*" &&
                                    alert.source.app.join(", ")}
                                </AlertsPanelFromKeyword>{" "}
                                {alert.source.app.length > 1 ? "apps" : "app"}
                              </>
                            </Show>{" "}
                            /{" "}
                            <Show
                              when={alert.source.stage !== "*"}
                              fallback={
                                <AlertsPanelFromKeyword>
                                  all stages
                                </AlertsPanelFromKeyword>
                              }
                            >
                              <>
                                <AlertsPanelFromKeyword>
                                  {alert.source.stage !== "*" &&
                                    alert.source.stage.join(", ")}
                                </AlertsPanelFromKeyword>{" "}
                                {alert.source.app !== "*" &&
                                alert.source.app.length === 1
                                  ? "stage"
                                  : "stages"}
                              </>
                            </Show>
                          </AlertsPanelRowFromLabel>
                          <Row space="1.5" vertical="start">
                            <Switch>
                              <Match
                                when={
                                  alert.destination.type === "email" &&
                                  alert.destination
                                }
                              >
                                {(destination) => (
                                  <>
                                    <AlertsPanelToIcon>
                                      <IconArrowLongRight
                                        width={12}
                                        height={12}
                                      />
                                    </AlertsPanelToIcon>
                                    <AlertsPanelToLabel>
                                      {destination().properties.users === "*"
                                        ? "To all users in the workspace"
                                        : (
                                            destination().properties
                                              .users as string[]
                                          )
                                            .map(
                                              (id) =>
                                                users.value.find(
                                                  (u) => u.id === id,
                                                )?.email,
                                            )
                                            .join(", ")}
                                    </AlertsPanelToLabel>
                                  </>
                                )}
                              </Match>
                              <Match
                                when={
                                  alert.destination.type === "slack" &&
                                  alert.destination
                                }
                              >
                                {(destination) => (
                                  <Switch>
                                    <Match when={slackWarnings()[alert.id]}>
                                      <AlertsPanelToIcon error>
                                        <IconExclamationTriangle
                                          width={12}
                                          height={12}
                                        />
                                      </AlertsPanelToIcon>
                                      <AlertsPanelToLabel error>
                                        Make sure to invite @SST to the{" "}
                                        {destination().properties.channel}{" "}
                                        channel
                                      </AlertsPanelToLabel>
                                    </Match>
                                    <Match when={true}>
                                      <AlertsPanelToIcon>
                                        <IconArrowLongRight
                                          width={12}
                                          height={12}
                                        />
                                      </AlertsPanelToIcon>
                                      <AlertsPanelToLabel>
                                        To channel{" "}
                                        {destination().properties.channel}
                                      </AlertsPanelToLabel>
                                    </Match>
                                  </Switch>
                                )}
                              </Match>
                            </Switch>
                          </Row>
                        </Stack>
                      </Row>
                      <Show when={!isEditingRow()}>
                        <Row flex={false} space="2">
                          <Button
                            onClick={() => editAlert(alert)}
                            color="secondary"
                            size="sm"
                          >
                            Edit
                          </Button>
                          <Dropdown
                            size="sm"
                            icon={
                              <IconEllipsisVertical width={18} height={18} />
                            }
                          >
                            <Dropdown.Item
                              onSelect={() => {
                                editAlert(alert, true);
                              }}
                            >
                              Duplicate alert
                            </Dropdown.Item>
                            <Dropdown.Seperator />
                            <Dropdown.Item
                              onSelect={() => {
                                rep().mutate.alert_remove(alert.id);
                              }}
                            >
                              Remove alert
                            </Dropdown.Item>
                          </Dropdown>
                        </Row>
                      </Show>
                    </AlertsPanelRow>
                    <Show when={isEditingRow()}>
                      <AlertsEditor />
                    </Show>
                  </>
                );
              }}
            </For>
            <Show when={editing.active && !editing.id}>
              <>
                <Show when={alerts.value.length !== 0}>
                  <AlertsPanelRow new>
                    <AlertsPanelRowIcon dimmed>
                      <IconEllipsisHorizontal width={18} height={18} />
                    </AlertsPanelRowIcon>
                    <Text size="sm" color="dimmed">
                      Add a new alert
                    </Text>
                  </AlertsPanelRow>
                </Show>
                <AlertsEditor />
              </>
            </Show>
            <Show
              when={
                alerts.value.length !== 0 && (!editing.active || editing.id)
              }
            >
              <AlertsPanelRow new>
                <AlertsPanelRowIcon>
                  <IconEllipsisHorizontal width={18} height={18} />
                </AlertsPanelRowIcon>
                <LinkButton
                  size="sm"
                  code={false}
                  weight="regular"
                  onClick={() => createAlert()}
                >
                  Add a new alert
                </LinkButton>
              </AlertsPanelRow>
            </Show>
          </AlertsPanel>
        </Show>
      </Stack>
    </>
  );
}
