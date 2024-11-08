import {
  For,
  Show,
  Match,
  Switch,
  createMemo,
  createEffect,
  createSignal,
} from "solid-js";
import { sortBy } from "remeda";
import { IconCheck, IconClipboard, IconDocumentDuplicate } from "$/ui/icons";
import { DateTime } from "luxon";
import { formatSinceTime } from "$/common/format";
import { styled } from "@macaron-css/solid";
import { NotFound } from "$/pages/not-found";
import { Link, useNavigate, useParams } from "@solidjs/router";
import { useReplicache } from "$/providers/replicache";
import { useReplicacheStatus } from "$/providers/replicache-status";
import { useStageContext } from "../context";
import { StateResourceStore } from "$/data/app";
import { NavigationAction, useCommandBar } from "../../command-bar";
import { Row, Stack } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";

const Container = styled("div", {
  base: {
    ...utility.row(6),
    padding: theme.space[4],
  },
});

const Content = styled("div", {
  base: {
    minWidth: 0,
    flex: "1 1 auto",
  },
});

const PageTitle = styled("h1", {
  base: {
    fontSize: theme.font.size.mono_xl,
    fontFamily: theme.font.family.code,
    fontWeight: theme.font.weight.medium,
    wordBreak: "break-all",
    lineHeight: "normal",
  },
});

const PageTitleTagline = styled("p", {
  base: {
    color: theme.color.text.secondary.base,
    wordBreak: "break-all",
  },
});

const PageTitleDesc = styled("p", {
  base: {
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.dimmed.base,
    lineHeight: "normal",
    wordBreak: "break-all",
  },
});

const OutputsEmpty = styled("div", {
  base: {
    height: 200,
    border: `1px solid ${theme.color.divider.base}`,
    borderRadius: theme.borderRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.color.text.dimmed.base,
  },
});

const Outputs = styled("div", {
  base: {
    borderRadius: 4,
    border: `1px solid ${theme.color.divider.base}`,
  },
});

const Output = styled("div", {
  base: {
    padding: theme.space[4],
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space[4],
    borderBottom: `1px solid ${theme.color.divider.base}`,
    selectors: {
      "&:last-child": {
        border: "none",
      },
    },
  },
});

const OutputKey = styled("span", {
  base: {
    ...utility.text.line,
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.primary.base,
    lineHeight: "normal",
    minWidth: "33%",
  },
});

const OutputValue = styled("span", {
  base: {
    ...utility.text.line,
    fontSize: theme.font.size.mono_sm,
    fontFamily: theme.font.family.code,
    color: theme.color.text.dimmed.base,
    lineHeight: "normal",
  },
});

const OutputIconButton = styled("button", {
  base: {
    flexShrink: 0,
    height: 16,
    width: 16,
    color: theme.color.icon.dimmed,
    ":disabled": {
      opacity: theme.color.button.primary.disabled.opacity,
      pointerEvents: "none",
    },
    ":hover": {
      color: theme.color.icon.secondary,
    },
  },
  variants: {
    copying: {
      true: {
        cursor: "default",
        color: theme.color.icon.dimmed,
        ":hover": {
          color: theme.color.icon.dimmed,
        },
      },
    },
  },
});

const Sidebar = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 300,
    paddingTop: theme.space[1.5],
  },
});

const PanelTitle = styled("span", {
  base: {
    ...utility.text.label,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.dimmed.base,
  },
});

const PanelValue = styled("span", {
  base: {
    color: theme.color.text.secondary.base,
  },
});

const PanelValueEmpty = styled("span", {
  base: {
    color: theme.color.text.dimmed.base,
  },
});

const PanelValueMonoLink = styled(Link, {
  base: {
    ...utility.text.line,
    minWidth: 0,
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    fontWeight: theme.font.weight.medium,
  },
});

export function Detail() {
  const params = useParams();
  const rep = useReplicache();
  const ctx = useStageContext();
  const replicacheStatus = useReplicacheStatus();
  const bar = useCommandBar();
  const nav = useNavigate();

  const resource = StateResourceStore.forStage.watch(
    rep,
    () => [ctx.stage.id],
    (res) => res.find((res) => res.urn === decodeURIComponent(params.urn)),
  );
  createEffect(() => {
    if (resource()) {
      console.log("Resource", resource());
    }
  });
  const outputs = createMemo(() =>
    resource() && Object.keys(resource()!.outputs).length
      ? Object.keys(resource()!.outputs).map((key) => ({
        key,
        value: resource()!.outputs[key],
      }))
      : [],
  );

  bar.register("resource-detail", async () => {
    return [
      ...(resource()?.parent
        ? [
          NavigationAction({
            category: "Resource",
            title: "Go to parent",
            nav,
            path: "../" + encodeURIComponent(resource()!.parent!),
          }),
        ]
        : []),
      {
        icon: IconClipboard,
        category: "Resource",
        title: "Copy URN",
        run: (control) => {
          control.hide();
          navigator.clipboard.writeText(resource()!.urn);
        },
      },
    ];
  });

  createEffect(() => {
    console.log("Resource", resource());
  });

  function renderOutput(key: string, value: any) {
    const [copying, setCopying] = createSignal(false);
    return (
      <Output>
        <OutputKey>{key}</OutputKey>
        <Row space="3" vertical="center">
          <OutputValue>
            {typeof value === "string" ? value : JSON.stringify(value)}
          </OutputValue>
          <Show when={value !== ""}>
            <OutputIconButton
              copying={copying()}
              onClick={() => {
                setCopying(true);
                navigator.clipboard.writeText(
                  typeof value === "string" ? value : JSON.stringify(value),
                );
                setTimeout(() => setCopying(false), 2000);
              }}
            >
              <Show when={!copying()} fallback={<IconCheck />}>
                <IconDocumentDuplicate />
              </Show>
            </OutputIconButton>
          </Show>
        </Row>
      </Output>
    );
  }

  return (
    <Switch>
      <Match
        when={
          replicacheStatus.isSynced(rep().name) && !resource() && resource.ready
        }
      >
        <NotFound inset="header-tabs" />
      </Match>
      <Match when={resource()}>
        <Container>
          <Content>
            <Stack space="7">
              <Stack space="2.5">
                <PageTitle>{getResourceName(resource()!.urn)}</PageTitle>
                <Stack space="1">
                  <PageTitleTagline>{resource()!.type}</PageTitleTagline>
                  <PageTitleDesc>{resource()!.urn}</PageTitleDesc>
                </Stack>
              </Stack>
              <Stack space="2">
                <PanelTitle>Outputs</PanelTitle>
                <Show
                  when={outputs().length}
                  fallback={<OutputsEmpty>No outputs</OutputsEmpty>}
                >
                  <Outputs>
                    <For each={sortBy(outputs(), (o) => o.key)}>
                      {({ key, value }) => renderOutput(key, value)}
                    </For>
                  </Outputs>
                </Show>
              </Stack>
            </Stack>
          </Content>
          <Sidebar>
            <Switch>
              <Match when={isV2Resource(resource()!.type)}>
                <Stack space="7">
                  <Stack space="2">
                    <PanelTitle>Created</PanelTitle>
                    <PanelValue>
                      <Show
                        when={resource()!.time.created}
                        fallback={<PanelValueEmpty>—</PanelValueEmpty>}
                      >
                        <span
                          title={DateTime.fromISO(
                            resource()!.time.created!,
                          ).toLocaleString(DateTime.DATETIME_FULL)}
                        >
                          {formatSinceTime(
                            DateTime.fromISO(
                              resource()!.time.created!,
                            ).toSQL()!,
                            true,
                          )}
                        </span>
                      </Show>
                    </PanelValue>
                  </Stack>
                  <Stack space="2">
                    <PanelTitle>Modified</PanelTitle>
                    <PanelValue>
                      <Show
                        when={resource()!.time.updated}
                        fallback={<PanelValueEmpty>—</PanelValueEmpty>}
                      >
                        <span
                          title={DateTime.fromISO(
                            resource()!.time.updated!,
                          ).toLocaleString(DateTime.DATETIME_FULL)}
                        >
                          {formatSinceTime(
                            DateTime.fromISO(
                              resource()!.time.updated!,
                            ).toSQL()!,
                            true,
                          )}
                        </span>
                      </Show>
                    </PanelValue>
                  </Stack>
                </Stack>
              </Match>
              <Match when={true}>
                <Stack space="7">
                  <Stack space="2">
                    <PanelTitle>Created</PanelTitle>
                    <PanelValue>
                      <Show
                        when={resource()!.time.stateCreated}
                        fallback={<PanelValueEmpty>—</PanelValueEmpty>}
                      >
                        <Show
                          when={resource()!.update.createdID}
                          fallback={
                            <span
                              title={DateTime.fromISO(
                                resource()!.time.stateCreated!,
                              ).toLocaleString(DateTime.DATETIME_FULL)}
                            >
                              {formatSinceTime(
                                DateTime.fromISO(
                                  resource()!.time.stateCreated!,
                                ).toSQL()!,
                                true,
                              )}
                            </span>
                          }
                        >
                          <Link
                            href={`../../updates/${resource()!.update.createdID}`}
                            title={DateTime.fromISO(
                              resource()!.time.stateCreated!,
                            ).toLocaleString(DateTime.DATETIME_FULL)}
                          >
                            {formatSinceTime(
                              DateTime.fromISO(
                                resource()!.time.stateCreated!,
                              ).toSQL()!,
                              true,
                            )}
                          </Link>
                        </Show>
                      </Show>
                    </PanelValue>
                  </Stack>
                  <Stack space="2">
                    <PanelTitle>Modified</PanelTitle>
                    <PanelValue>
                      <Show
                        when={
                          resource()!.time.stateModified &&
                          resource()!.time.stateCreated !==
                          resource()!.time.stateModified
                        }
                        fallback={<PanelValueEmpty>—</PanelValueEmpty>}
                      >
                        <Show
                          when={resource()!.update.modifiedID}
                          fallback={
                            <span
                              title={DateTime.fromISO(
                                resource()!.time.stateModified!,
                              ).toLocaleString(DateTime.DATETIME_FULL)}
                            >
                              {formatSinceTime(
                                DateTime.fromISO(
                                  resource()!.time.stateModified!,
                                ).toSQL()!,
                                true,
                              )}
                            </span>
                          }
                        >
                          <Link
                            href={`../../updates/${resource()!.update.modifiedID!}`}
                            title={DateTime.fromISO(
                              resource()!.time.stateModified!,
                            ).toLocaleString(DateTime.DATETIME_FULL)}
                          >
                            {formatSinceTime(
                              DateTime.fromISO(
                                resource()!.time.stateModified!,
                              ).toSQL()!,
                              true,
                            )}
                          </Link>
                        </Show>
                      </Show>
                    </PanelValue>
                  </Stack>
                  <Stack space="2">
                    <PanelTitle>Parent</PanelTitle>
                    <Show
                      when={resource()!.parent}
                      fallback={<PanelValueEmpty>—</PanelValueEmpty>}
                    >
                      <PanelValueMonoLink
                        href={`../${encodeURIComponent(resource()!.parent!)}`}
                      >
                        {getResourceName(resource()!.parent!)}
                      </PanelValueMonoLink>
                    </Show>
                  </Stack>
                </Stack>
              </Match>
            </Switch>
          </Sidebar>
        </Container>
      </Match>
    </Switch>
  );
}

function getResourceName(urn: string) {
  return urn.split("::").at(-1);
}

function isV2Resource(type: string) {
  return type.startsWith("sstv2");
}
