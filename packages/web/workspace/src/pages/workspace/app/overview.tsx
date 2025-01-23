import { DateTime } from "luxon";
import { For, Show, Match, Switch } from "solid-js";
import { RunStore, StateUpdateStore } from "../../../data/app";
import { PageHeader } from "./header";
import { A } from "@solidjs/router";
import { useAppContext } from "./context";
import { style } from "@macaron-css/core";
import { styled } from "@macaron-css/solid";
import type { Stage } from "@console/core/app/stage"
import { sortBy } from "remeda";
import { parseTime, formatSinceTime, formatCommit } from "../../../common/format";
import { githubRepo, githubCommit } from "../../../common/url-builder";
import { ActiveStagesForApp } from "../../../data/stage";
import { useLocalContext } from "../../../providers/local";
import { createSubscription } from "../../../providers/replicache";
import { IconTag } from "../../../ui/icons";
import { IconCommit, IconPr, IconGit } from "../../../ui/icons/custom";
import { Row, Stack } from "../../../ui/layout";
import { Tag } from "../../../ui/tag";
import { theme } from "../../../ui/theme";
import { utility } from "../../../ui/utility";
import { AccountStore } from "@console/web/data/aws/account";

const Root = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const Stages = styled("div", {
  base: {
    ...utility.stack(4),
  },
});

const CardRoot = styled("div", {
  base: {
    ...utility.row(10),
    position: "relative",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.borderRadius,
    border: `1px solid ${theme.color.divider.base}`,
    padding: `${theme.space[3]} ${theme.space[4]} ${theme.space[4]} ${theme.space[4]}`,
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

const CardBodyLeft = styled("div", {
  base: {
    ...utility.stack(2),
    minWidth: 0,
  },
});

const CardTitle = styled("div", {
  base: {
    ...utility.row(3),
    alignItems: "center",
    minWidth: 0,
  },
});

const CardTitleText = styled(A, {
  base: {
    ...utility.text.line,
    zIndex: 2,
    lineHeight: "26px",
    color: theme.color.text.primary.base,
    fontWeight: theme.font.weight.medium,
  },
});

const CardInternalLink = styled(A, {
  base: {
    zIndex: 2,
  },
});

const CardIcon = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 12,
    height: 12,
    borderRadius: "50%",
  },
  variants: {
    status: {
      base: {
        backgroundColor: theme.color.divider.base,
      },
      unsupported: {
        opacity: 0.5,
        backgroundColor: theme.color.divider.base,
      },
      success: {
        backgroundColor: `hsla(${theme.color.base.blue}, 100%)`,
      },
      error: {
        backgroundColor: `hsla(${theme.color.base.red}, 100%)`,
      },
      updating: {
        backgroundColor: `hsla(${theme.color.base.yellow}, 100%)`,
        animation: "glow-pulse-status 1.7s linear infinite alternate",
      },
    },
  },
});

const CardUpdatedTime = styled("span", {
  base: {
    zIndex: 2,
    marginLeft: `calc(${theme.space[3]} + 12px)`,
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

const CardBodyRight = styled("div", {
  base: {
    ...utility.row(20),
  },
});

const CardRegion = styled("span", {
  base: {
    ...utility.text.line,
    letterSpacing: 0.5,
    lineHeight: "26px",
    textAlign: "right",
    textTransform: "uppercase",
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

const cardAccountId = style({
  zIndex: 2,
  userSelect: "text",
  WebkitUserSelect: "text",
});

const CardGit = styled("div", {
  base: {
    ...utility.stack(1.5),
    alignItems: "stretch",
    justifyContent: "center",
  },
});

const CardGitLink = styled("a", {
  base: {
    ...utility.row(1),
    zIndex: 2,
    alignItems: "center",
  },
});

const CardGitIcon = styled("span", {
  base: {
    lineHeight: 0,
    opacity: theme.iconOpacity,
    color: theme.color.text.secondary.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${CardGitLink}:hover &`]: {
        color: theme.color.text.primary.base,
      },
    },
  },
  variants: {
    size: {
      sm: {
        width: 12,
        height: 12,
        color: theme.color.text.dimmed.base,
        selectors: {
          [`${CardGitLink}:hover &`]: {
            color: theme.color.text.secondary.base,
          },
        },
      },
      md: {
        width: 14,
        height: 14,
      },
    },
  },
});

const CardGitBranch = styled("span", {
  base: {
    ...utility.text.line,
    maxWidth: 140,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${CardGitLink}:hover &`]: {
        color: theme.color.link.primary.hover,
      },
    },
  },
});

const CardGitCommit = styled("span", {
  base: {
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.secondary.base,
    fontWeight: theme.font.weight.medium,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${CardGitLink}:hover &`]: {
        color: theme.color.link.primary.hover,
      },
    },
  },
});

const CardGitMessage = styled("div", {
  base: {
    ...utility.text.line,
    width: 260,
    lineHeight: "normal",
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

export function Overview() {
  const app = useAppContext();
  const local = useLocalContext();
  const stages = createSubscription(() => {
    const appID = app.app.id;
    return async (tx) => {
      return sortBy(
        await ActiveStagesForApp(appID)(tx),
        (stage) =>
          app.app.name === local.app && stage.name === local.stage ? 0 : 1,
        [(stage) => stage.timeUpdated, "desc"],
      );
    };
  });

  function Card(props: { stage: Stage.Info }) {
    const latest = createSubscription(() => async (tx) => {
      const updates = await StateUpdateStore.forStage(tx, props.stage.id);
      if (!updates.length) return;
      const update = updates.sort((a, b) => b.index - a.index)[0];
      let result = {
        update,
      };
      if (!update.runID) return result;
      const run = await RunStore.get(tx, update.runID);
      if (run?.trigger.source !== "github") result;
      if (!run) return result;
      if (!run.trigger.commit) return result;
      const repoUrl = githubRepo(run.trigger.repo.owner, run.trigger.repo.repo);
      return {
        ...result,
        url: githubCommit(repoUrl, run.trigger.commit.id),
        trigger: run.trigger,
      };
    });
    const local = useLocalContext();
    const aws = createSubscription(
      () => async (tx) => AccountStore.get(tx, props.stage.awsAccountID),
    );
    return (
      <CardRoot>
        <BlockLink href={props.stage.name}></BlockLink>
        <CardBodyLeft>
          <CardTitle>
            <Switch>
              <Match when={props.stage.unsupported}>
                <CardIcon status="unsupported" />
              </Match>
              <Match when={latest.value && !latest.value.update.time.completed}>
                <CardIcon status="updating" />
              </Match>
              <Match
                when={
                  latest.value?.update.time.completed &&
                  latest.value?.update.errors.length === 0
                }
              >
                <CardIcon status="success" />
              </Match>
              <Match when={latest.value?.update.errors.length}>
                <CardIcon status="error" />
              </Match>
              <Match when={true}>
                <CardIcon status="base" />
              </Match>
            </Switch>
            <Row space="2">
              <CardTitleText href={props.stage.name}>
                {props.stage.name}
              </CardTitleText>
              <Show
                when={
                  props.stage.name === local.stage && app.app.name === local.app
                }
              >
                <CardInternalLink href={`${props.stage.name}/local`}>
                  <Tag level="tip" type="outline">
                    Local
                  </Tag>
                </CardInternalLink>
              </Show>
              <Show when={latest.value?.update.errors.length}>
                <CardInternalLink
                  href={`${props.stage.name}/updates/${latest.value?.update.id}`}
                >
                  <Tag level="danger" type="outline">
                    Error
                  </Tag>
                </CardInternalLink>
              </Show>
            </Row>
          </CardTitle>
          <CardUpdatedTime
            title={parseTime(props.stage.timeUpdated).toLocaleString(
              DateTime.DATETIME_FULL,
            )}
          >
            Updated {formatSinceTime(props.stage.timeUpdated, true)}
          </CardUpdatedTime>
        </CardBodyLeft>
        <CardBodyRight>
          <Show
            when={
              latest.value && "trigger" in latest.value ? latest.value : false
            }
          >
            {(v) => (
              <CardGit>
                <Row space="2">
                  <CardGitLink target="_blank" href={v().url}>
                    <CardGitIcon size="md">
                      <IconCommit />
                    </CardGitIcon>
                    <CardGitCommit>
                      {formatCommit(v().trigger.commit?.id || "")}
                    </CardGitCommit>
                  </CardGitLink>
                  <CardGitLink target="_blank" href={v().url}>
                    <CardGitIcon size="sm">
                      <Switch>
                        <Match when={v().trigger.type === "pull_request"}>
                          <IconPr />
                        </Match>
                        <Match when={v().trigger.type === "tag"}>
                          <IconTag />
                        </Match>
                        <Match when={v().trigger.type === "branch"}>
                          <IconGit />
                        </Match>
                      </Switch>
                    </CardGitIcon>
                    <CardGitBranch>
                      {(() => {
                        const trigger = v().trigger;
                        if (trigger.type === "branch") return trigger.branch;
                        if (trigger.type === "tag") return trigger.tag;
                        // @ts-expect-error TODO
                        return trigger.base;
                      })()}
                    </CardGitBranch>
                  </CardGitLink>
                </Row>
                <CardGitMessage>{v().trigger.commit?.message}</CardGitMessage>
              </CardGit>
            )}
          </Show>
          <Stack space="px">
            <CardRegion>{props.stage.region}</CardRegion>
            <Tag class={cardAccountId} title="AWS Account ID">
              {aws.value?.accountID}
            </Tag>
          </Stack>
        </CardBodyRight>
      </CardRoot>
    );
  }

  return (
    <>
      <PageHeader />
      <Root>
        <Stages>
          <For each={stages.value}>{(stage) => <Card stage={stage} />}</For>
        </Stages>
      </Root>
    </>
  );
}
