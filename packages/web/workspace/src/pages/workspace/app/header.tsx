import { DateTime } from "luxon";
import { createMemo, Show } from "solid-js";
import { styled } from "@macaron-css/solid";
import { Link } from "@solidjs/router";

import { theme } from "$/ui/theme";
import { Button } from "$/ui/button";
import { utility } from "$/ui/utility";
import { Row, Stack } from "$/ui/layout";
import {
  RunStore,
  AppRepoStore,
  GithubOrgStore,
  GithubRepoStore,
} from "$/data/app";
import { IconGitHub } from "$/ui/icons/custom";
import { TabTitle, ButtonIcon } from "$/ui/button";
import { createSubscription } from "$/providers/replicache";

import { Header } from "../header";
import { useWorkspace } from "../context";
import { useAppContext } from "./context";


const PageHeaderRoot = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    padding: `0 ${theme.space[4]}`,
    justifyContent: "space-between",
    height: theme.headerHeight.stage,
    borderBottom: `1px solid ${theme.color.divider.base}`,
  },
});

const RepoLink = styled("a", {
  base: {
    ...utility.row(0),
    gap: 5,
    color: theme.color.text.secondary.base,
    fontSize: theme.font.size.sm,
    ":hover": {
      color: theme.color.text.primary.base,
    },
  },
});

const RepoLinkCopy = styled("span", {
  base: {
    ...utility.row(0),
    alignItems: "center",
  },
});

const RepoLinkIcon = styled("span", {
  base: {
    lineHeight: 0,
    color: theme.color.icon.secondary,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    selectors: {
      [`${RepoLink}:hover &`]: {
        color: theme.color.icon.primary,
      },
    },
  },
});

const RepoLinkSeparator = styled("span", {
  base: {
    color: theme.color.text.dimmed.base,
    paddingInline: 3,
    transition: `color ${theme.colorFadeDuration} ease-out`,
    fontSize: theme.font.size.xs,
    selectors: {
      [`${RepoLink}:hover &`]: {
        color: theme.color.text.secondary.base,
      },
    },
  },
});

export function PageHeader() {
  const ctx = useAppContext();
  const workspace = useWorkspace();
  const r = createSubscription(async (tx) => {
    const runs = await RunStore.all(tx);
    const run = runs
      .filter((run) => run.appID === ctx.app.id)
      .sort(
        (a, b) =>
          DateTime.fromISO(b.time.created).toMillis() -
          DateTime.fromISO(a.time.created).toMillis(),
      )[0];
    const latestRunError = run?.status === "error";

    const appRepo = await AppRepoStore.forApp(tx, ctx.app.id);
    const ghRepo = (await GithubRepoStore.all(tx)).find(
      (repo) => repo.id === appRepo[0]?.repoID,
    );

    if (!ghRepo) return { latestRunError };

    const ghRepoOrg = (await GithubOrgStore.all(tx)).find(
      (org) => org.id === ghRepo.githubOrgID && !org.time.disconnected,
    );

    return {
      ghRepo,
      ghRepoOrg,
      latestRunError,
    };
  });
  const appUrl = createMemo(() =>
    `/${workspace().slug}/${ctx.app.name}`,
  );

  return (
    <>
      <Header app={ctx.app.name} />
      <Show when={r.value!}>
        <PageHeaderRoot>
          <Row space="5" vertical="center">
            <Link end href={appUrl()}>
              <TabTitle size="sm">Stages</TabTitle>
            </Link>
            <Link href={`${appUrl()}/autodeploy`}>
              <TabTitle size="sm" count={r.value!.latestRunError ? "•" : ""}>
                Autodeploy
              </TabTitle>
            </Link>
            <Link href={`${appUrl()}/settings`}>
              <TabTitle size="sm">Settings</TabTitle>
            </Link>
          </Row>
          <Show
            when={r.value!.ghRepoOrg}
            fallback={
              <Link href={`${appUrl()}/settings#repo`}>
                <Button color="github" size="sm">
                  <ButtonIcon size="sm">
                    <IconGitHub />
                  </ButtonIcon>
                  Connect Repo
                </Button>
              </Link>
            }
          >
            <Stack space="2" horizontal="end">
              <RepoLink
                target="_blank"
                href={`https://github.com/${r.value!.ghRepoOrg!.login}/${r.value!.ghRepo!.name
                  }`}
              >
                <RepoLinkIcon><IconGitHub width="16" height="16" /></RepoLinkIcon>
                <RepoLinkCopy>
                  {r.value!.ghRepoOrg!.login}
                  <RepoLinkSeparator>/</RepoLinkSeparator>
                  {r.value!.ghRepo!.name}
                </RepoLinkCopy>
              </RepoLink>
            </Stack>
          </Show>
        </PageHeaderRoot>
      </Show>
    </>
  );
}
