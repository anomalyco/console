import { pipe, filter, sortBy } from "remeda";
import { DateTime } from "luxon";
import { Row } from "$/ui/layout";
import { Link } from "@solidjs/router";
import { styled } from "@macaron-css/solid";
import { useAppContext } from "../context";
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
  githubBranch,
  githubCommit,
  githubTag,
} from "$/common/url-builder";
import { RunStore } from "$/data/app";
import { StageStore } from "$/data/stage";
import { For, Show, Match, Switch, createMemo } from "solid-js";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";

export function ERROR_MAP(error: Exclude<Run.Run["error"], undefined>) {
  switch (error.type) {
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

const STATUS_MAP = {
  queued: "Queued",
  skipped: "Skipped",
  updated: "Deployed",
  error: "Failed",
  updating: "Deploying",
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

const RunBlockLink = styled(Link, {
  base: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
});

const RunCol1 = styled("div", {
  base: {
    ...utility.row(3),
    flex: "0 0 auto",
    width: 220,
    alignItems: "center",
  },
});

const RunCircleIcon = styled("div", {
  base: {
    width: 12,
    height: 12,
    borderRadius: "50%",
  },
  variants: {
    status: {
      error: {},
      updated: {},
      skipped: {
        backgroundColor: theme.color.divider.base,
      },
      queued: {
        backgroundColor: theme.color.divider.base,
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

const RunCol2 = styled("div", {
  base: {
    ...utility.row(0),
    flex: "1 1 auto",
    minWidth: 0,
    gap: 8,
    alignItems: "center",
  },
});

const RunMessageIcon = styled("div", {
  base: {
    lineHeight: 0,
    opacity: theme.iconOpacity,
    color: theme.color.text.secondary.base,
  },
  variants: {
    error: {
      true: {
        color: theme.color.text.danger.base,
      },
    },
  },
});

const RunMessageCopy = styled("p", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.danger.base,
  },
});

const RunStatusCopy = styled("p", {
  base: {
    lineHeight: "normal",
    fontSize: theme.font.size.sm,
    color: theme.color.text.dimmed.base,
  },
});

const RunMessageLink = styled(Link, {
  base: {
    ...utility.text.line,
    zIndex: 2,
    color: theme.color.text.secondary.base,
  },
});

const RunGit = styled("div", {
  base: {
    ...utility.row(2),
    flex: "0 0 auto",
    alignItems: "center",
    minWidth: 0,
  },
});

const RunGitEvent = styled("span", {
  base: {
    ...utility.row(1),
    alignItems: "center",
  },
});

const RunGitLink = styled("a", {
  base: {
    ...utility.row(1),
    zIndex: 2,
    alignItems: "center",
  },
});

const RunGitIcon = styled("span", {
  base: {
    lineHeight: 0,
    color: theme.color.icon.primary,
    transition: `color ${theme.colorFadeDuration} ease-out`,
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
        lineHeight: "normal",
        width: 14,
        height: 14,
      },
    },
  },
});

const RunGitBranch = styled(Link, {
  base: {
    ...utility.text.line,
    zIndex: 2,
    maxWidth: 150,
    lineHeight: "normal",
    fontWeight: theme.font.weight.medium,
    color: theme.color.text.primary.base,
  },
});

const RunGitCommit = styled("span", {
  base: {
    lineHeight: "normal",
    fontFamily: theme.font.family.code,
    fontSize: theme.font.size.mono_sm,
    color: theme.color.text.secondary.base,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${RunGitLink}:hover &`]: {
        color: theme.color.link.primary.hover,
      },
    },
  },
});

const RunGitMessage = styled("span", {
  base: {
    ...utility.text.line,
    lineHeight: "normal",
    width: 180,
    fontSize: theme.font.size.xs,
    color: theme.color.text.dimmed.base,
  },
});

const RunTime = styled("div", {
  base: {
    ...utility.text.line,
    flex: "0 0 auto",
    zIndex: 2,
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
  const stage = createSubscription(async (tx) => {
    if (!run.stageID) return;
    return await StageStore.get(tx, run.stageID);
  });

  const runInfo = createMemo(() => {
    const trigger = run.trigger;
    const repoURL =
      trigger.source === "github"
        ? githubRepo(trigger.repo.owner, trigger.repo.repo)
        : "";
    const branch =
      trigger.type === "pull_request"
        ? `pr#${trigger.number}`
        : trigger.type === "tag"
          ? trigger.tag
          : trigger.branch;
    const uri =
      trigger.type === "pull_request"
        ? githubPr(repoURL, trigger.number)
        : trigger.type === "tag"
          ? githubTag(repoURL, trigger.tag)
          : githubBranch(repoURL, trigger.branch);

    return { trigger, repoURL, branch, uri };
  });

  return (
    <RunRoot>
      <RunBlockLink href={run.id} />
      <RunCol1>
        <RunSenderAvatar title={runInfo()!.trigger.sender.username}>
          <img
            width="24"
            height="24"
            src={`https://avatars.githubusercontent.com/u/${runInfo()!.trigger.sender.id
              }?s=48&v=4`}
          />
        </RunSenderAvatar>
        <RunGitEvent>
          <RunGitIcon size="md">
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
          <RunGitBranch href={run.id}>{runInfo()!.branch}</RunGitBranch>
        </RunGitEvent>
      </RunCol1>
      <RunCol2>
        <Switch>
          <Match when={run.error}>
            <RunMessageIcon error>
              <IconExclamationTriangle width="14" height="14" />
            </RunMessageIcon>
            <RunMessageCopy>{ERROR_MAP(run.error!)}</RunMessageCopy>
          </Match>
          <Match when={
            run.status === "queued" || run.status === "updating" || run.status === "skipped"
          }>
            <RunCircleIcon status={run.status} />
            <RunStatusCopy>{STATUS_MAP[run.status]}</RunStatusCopy>
          </Match>
          <Match when={stage.value}>
            <RunMessageIcon>
              <IconArrowLongRight width="14" height="14" />
            </RunMessageIcon>
            <RunMessageLink href={`../${stage.value?.name!}`}>
              {stage.value?.name}
            </RunMessageLink>
          </Match>
        </Switch>
      </RunCol2>
      <RunGit>
        <RunGitLink
          target="_blank"
          href={githubCommit(
            runInfo()!.repoURL,
            runInfo()!.trigger.commit.id,
          )}
        >
          <RunGitIcon size="sm">
            <IconCommit />
          </RunGitIcon>
          <RunGitCommit>
            {formatCommit(runInfo()!.trigger.commit.id)}
          </RunGitCommit>
        </RunGitLink>
        <Show when={runInfo()!.trigger.commit.message}>
          <RunGitMessage>{runInfo()!.trigger.commit.message}</RunGitMessage>
        </Show>
      </RunGit>
      <Show when={run.time.created} fallback={<RunTime>—</RunTime>}>
        <RunTime
          title={DateTime.fromISO(run.time.created!).toLocaleString(
            DateTime.DATETIME_FULL,
          )}
        >
          {formatSinceTime(DateTime.fromISO(run.time.created!).toSQL()!)}
        </RunTime>
      </Show>
    </RunRoot>
  );
}

export function List() {
  const ctx = useAppContext();
  const runs = createSubscription(async (tx) => {
    const all = await RunStore.all(tx);

    return pipe(
      all,
      filter((run) => run.appID === ctx.app.id),
      sortBy([(run) => run.time.created, "desc"]),
    );
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
