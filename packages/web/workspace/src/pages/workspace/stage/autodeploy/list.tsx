import { pipe, filter, sortBy } from "remeda";
import { DateTime } from "luxon";
import { Row } from "$/ui/layout";
import { Link } from "@solidjs/router";
import { styled } from "@macaron-css/solid";
import { useStageContext } from "../context";
import {
  IconArrowLongRight,
  IconExclamationTriangle,
  IconTag,
} from "$/ui/icons";
import { inputFocusStyles } from "$/ui/form";
import type { Run } from "@console/core/run";
import { globalKeyframes } from "@macaron-css/core";
import { IconPr, IconGit, IconCommit } from "$/ui/icons/custom";
import { formatCommit, formatSinceTime } from "$/common/format";
import { createSubscription } from "$/providers/replicache";
import {
  githubPr,
  githubRepo,
  githubRef,
  githubCommit,
} from "$/common/url-builder";
import { RunStore } from "$/data/app";
import { StageStore } from "$/data/stage";
import { For, Show, Match, Switch, createMemo } from "solid-js";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";

export function ERROR_MAP(error: Exclude<Run.Run["error"], undefined>) {
  switch (error.type) {
    case "manual_deploy_ref_not_found":
      return "No git commit found for the branch, tag, or commit hash";
    case "config_not_found":
      return error.properties?.path
        ? `No sst.config.ts was found in ${error.properties.path}`
        : "No sst.config.ts was found in the repo root";
    case "config_build_failed":
      return "Failed to compile sst.config.ts";
    case "config_parse_failed":
      return "Failed to run sst.config.ts";
    case "config_evaluate_failed":
      return "Error evaluating sst.config.ts";
    case "config_target_returned_undefined":
      return '"console.autodeploy.target" in the config returned "undefined"';
    case "config_branch_remove_skipped":
      return "Skipped branch remove";
    case "config_tag_skipped":
      return "Skipped tag events";
    case "config_target_no_stage":
      return '"console.autodeploy.target" in the config did not return a stage';
    case "config_v2_unsupported":
      return "Autodeploy does not support SST v2 apps";
    case "config_app_name_mismatch":
      return `sst.config.ts is for app "${error.properties?.name}"`;
    case "target_not_found":
      return "Add an environment in your app settings";
    case "target_not_matched":
      return `No matching environments for "${error.properties?.stage}" in the app settings`;
    case "target_missing_aws_account":
      return `No AWS account for "${error.properties?.target}" in the app settings`;
    case "target_missing_workspace":
      return `AWS account for "${error.properties?.target}" is not configured`;
    case "run_failed":
      return error.properties?.message || "Error running `sst deploy`";
    case "unknown":
      return (
        error.properties?.message || "Deploy failed before running `sst deploy`"
      );
    default:
      return "Error running this deploy";
  }
}

export const STATUS_MAP = {
  queued: "Queued",
  skipped: "Skipped",
  updated: "Deployed",
  error: "Failed",
  updating: "In Progress",
};

const Content = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const EmptyRunsSign = styled("div", {
  base: {
    ...utility.stack(5),
    alignItems: "center",
    justifyContent: "center",
    height: 300,
    padding: `0 ${theme.space[4]}`,
  },
});

const EmptyRunsHelper = styled("div", {
  base: {
    ...utility.stack(5),
    color: theme.color.text.dimmed.base,
  },
});

const EmptyRunsHelperHeader = styled("span", {
  base: {
    textAlign: "center",
    marginLeft: theme.space[3.5],
    marginRight: theme.space[3.5],
    paddingBottom: theme.space[5],
    borderBottom: `2px dashed ${theme.color.divider.base}`,
    fontSize: theme.font.size.lg,
  },
});

const EmptyRunsHint = styled("ul", {
  base: {
    ...utility.stack(3),
    paddingLeft: 30,
    listStyle: "circle",
    fontSize: theme.font.size.base,
  },
});

const EmptyRunsHintCode = styled("span", {
  base: {
    fontSize: theme.font.size.mono_base,
    fontFamily: theme.font.family.code,
  },
});

const RunRoot = styled("div", {
  base: {
    ...utility.row(4),
    justifyContent: "space-between",
    padding: theme.space[4],
    alignItems: "center",
    borderStyle: "solid",
    borderWidth: "0 1px 1px 1px",
    borderColor: theme.color.divider.base,
    position: "relative",
    ":first-child": {
      borderWidth: 1,
      borderTopLeftRadius: theme.borderRadius,
      borderTopRightRadius: theme.borderRadius,
    },
    ":last-child": {
      borderBottomLeftRadius: theme.borderRadius,
      borderBottomRightRadius: theme.borderRadius,
    },
    selectors: {
      "&[data-focus='true']": {
        ...inputFocusStyles,
        outlineOffset: -1,
      },
    },
  },
});

const RunLeftCol = styled("div", {
  base: {
    ...utility.row(2),
    flexShrink: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const RunStatus = styled("div", {
  base: {
    ...utility.row(3),
    flex: "0 0 auto",
    minWidth: 0,
    width: 120,
    alignItems: "center",
  },
});

export const RunStatusIcon = styled("div", {
  base: {
    width: 12,
    height: 12,
    borderRadius: "50%",
  },
  variants: {
    status: {
      skipped: {
        backgroundColor: theme.color.divider.base,
      },
      queued: {
        backgroundColor: theme.color.divider.base,
      },
      updated: {
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

globalKeyframes("glow-pulse-status", {
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

const RunLink = styled(Link, {
  base: {
    fontWeight: theme.font.weight.medium,
  },
  variants: {
    error: {
      true: {
        color: theme.color.text.danger.base,
        ":hover": {
          color: `hsla(${theme.color.red.d1}, 90%)`,
        },
      },
    },
  },
});

const RunMessage = styled("div", {
  base: {
    ...utility.row(0),
    flex: "1 1 auto",
    minWidth: 0,
    gap: 5,
    alignItems: "center",
    maxWidth: 300,
  },
});

const RunMessageIcon = styled("div", {
  base: {
    lineHeight: 0,
    opacity: theme.iconOpacity,
    color: theme.color.text.secondary.base,
  },
});

const RunMessageCopy = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.base,
  },
});

const RunGit = styled("div", {
  base: {
    ...utility.row(2),
    flex: "1 1 auto",
    minWidth: 0,
    alignItems: "center",
    width: 460,
  },
});

const RunGitLink = styled("a", {
  base: {
    ...utility.row(1),
    alignItems: "center",
  },
});

const RunGitIcon = styled("span", {
  base: {
    lineHeight: 0,
    color: theme.color.icon.secondary,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${RunGitLink}:hover &`]: {
        color: theme.color.text.primary.base,
      },
    },
  },
  variants: {
    size: {
      sm: {
        width: 12,
        height: 12,
        color: theme.color.icon.dimmed,
        selectors: {
          [`${RunGitLink}:hover &`]: {
            color: theme.color.icon.secondary,
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

const RunGitBranch = styled("span", {
  base: {
    ...utility.text.line,
    maxWidth: 140,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${RunGitLink}:hover &`]: {
        color: theme.color.text.secondary.base,
      },
    },
  },
});

const RunGitCommit = styled("span", {
  base: {
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_base,
    color: theme.color.text.secondary.base,
    fontWeight: theme.font.weight.medium,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${RunGitLink}:hover &`]: {
        color: theme.color.text.primary.base,
      },
    },
  },
});

const RunGitMessage = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    maxWidth: 260,
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

const RunRightCol = styled("div", {
  base: {
    ...utility.row(20),
    flexShrink: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
  },
});

const RunTime = styled("span", {
  base: {
    ...utility.text.line,
    flex: "0 0 auto",
    width: 120,
    textAlign: "right",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
  },
});

const RunSenderAvatar = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 24,
    height: 24,
    overflow: "hidden",
    borderRadius: theme.borderRadius,
  },
});

function RunItem({ run }: { run: Run.Run }) {
  const runInfo = createMemo(() => {
    const trigger = run.trigger;
    const repoURL =
      trigger.source === "github"
        ? githubRepo(trigger.repo.owner, trigger.repo.repo)
        : "";
    const ref =
      trigger.type === "pull_request"
        ? `pr#${trigger.number}`
        : trigger.type === "tag"
        ? trigger.tag
        : trigger.type === "branch"
        ? trigger.branch
        : trigger.ref;
    const uri =
      trigger.type === "pull_request"
        ? githubPr(repoURL, trigger.number)
        : trigger.type === "tag"
        ? githubRef(repoURL, trigger.tag)
        : trigger.type === "branch"
        ? githubRef(repoURL, trigger.branch)
        : githubRef(repoURL, trigger.ref);
    const gitUser = trigger.type === "user" ? undefined : trigger.sender;

    return { trigger, repoURL, ref, uri, gitUser };
  });

  return (
    <RunRoot>
      <RunLeftCol>
        <RunStatus>
          <RunStatusIcon status={run.status} />
          <RunLink href={run.id} error={run.status === "error"}>
            {STATUS_MAP[run.status]}
          </RunLink>
        </RunStatus>
        <RunMessage>
          <Switch>
            <Match when={run.status === "error"}>
              <>
                <RunMessageIcon>
                  <IconExclamationTriangle width="14" height="14" />
                </RunMessageIcon>
                <RunMessageCopy>{ERROR_MAP(run.error!)}</RunMessageCopy>
              </>
            </Match>
          </Switch>
        </RunMessage>
      </RunLeftCol>
      <RunRightCol>
        <RunGit>
          <Show when={runInfo()!.gitUser}>
            <RunSenderAvatar title={runInfo()!.gitUser!.username}>
              <img
                width="24"
                height="24"
                src={`https://avatars.githubusercontent.com/u/${
                  runInfo()!.gitUser!.id
                }?s=48&v=4`}
              />
            </RunSenderAvatar>
          </Show>
          <RunGitLink
            target="_blank"
            href={githubCommit(
              runInfo()!.repoURL,
              runInfo()!.trigger.commit.id
            )}
          >
            <RunGitIcon size="md">
              <IconCommit />
            </RunGitIcon>
            <RunGitCommit>
              {formatCommit(runInfo()!.trigger.commit.id)}
            </RunGitCommit>
          </RunGitLink>
          <RunGitLink target="_blank" href={runInfo()!.uri}>
            <RunGitIcon size="sm">
              <Switch>
                <Match when={runInfo()!.trigger.type === "pull_request"}>
                  <IconPr />
                </Match>
                <Match when={runInfo()!.trigger.type === "tag"}>
                  <IconTag />
                </Match>
                <Match when={true}>
                  <IconGit />
                </Match>
              </Switch>
            </RunGitIcon>
            <RunGitBranch>{runInfo()!.ref}</RunGitBranch>
          </RunGitLink>
          <Show when={runInfo()!.trigger.commit.message}>
            <RunGitMessage>{runInfo()!.trigger.commit.message}</RunGitMessage>
          </Show>
        </RunGit>
        <Show when={run.time.created} fallback={<RunTime>—</RunTime>}>
          <RunTime
            title={DateTime.fromISO(run.time.created!).toLocaleString(
              DateTime.DATETIME_FULL
            )}
          >
            {formatSinceTime(DateTime.fromISO(run.time.created!).toSQL()!)}
          </RunTime>
        </Show>
      </RunRightCol>
    </RunRoot>
  );
}

export function List() {
  const ctx = useStageContext();
  const runs = createSubscription(async (tx) => {
    const all = await RunStore.forStage(tx, ctx.stage.id);
    return pipe(all, sortBy([(run) => run.time.created, "desc"]));
  });

  return (
    <Content>
      <Show when={runs.value && runs.value.length === 0}>
        <EmptyRunsSign>
          <EmptyRunsHelper>
            <EmptyRunsHelperHeader>Autodeploy your app</EmptyRunsHelperHeader>
            <EmptyRunsHint>
              <li>Connect your app to its GitHub repo</li>
              <li>
                Add an environment for your{" "}
                <EmptyRunsHintCode>`production`</EmptyRunsHintCode> branch
              </li>
              <li>
                Git push to deploy{" "}
                <EmptyRunsHintCode>
                  `git push origin main:production`
                </EmptyRunsHintCode>
              </li>
            </EmptyRunsHint>
          </EmptyRunsHelper>
        </EmptyRunsSign>
      </Show>
      <For each={runs.value}>{(run) => <RunItem run={run} />}</For>
    </Content>
  );
}
