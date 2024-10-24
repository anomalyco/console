import { Link, Route, Routes } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { HeaderSlot } from "../../header";
import { Show } from "solid-js";
import { styled } from "@macaron-css/solid";
import { IconGitHub } from "$/ui/icons/custom";
import { createSubscription } from "$/providers/replicache";
import { AppRepoStore, GithubOrgStore, GithubRepoStore } from "$/data/app";
import { useStageContext } from "../context";
import { ButtonIcon } from "$/ui/button";
import { Stack } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { utility } from "$/ui/utility";
import { Button } from "$/ui/button";

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

export function Autodeploy() {
  const ctx = useStageContext();
  const ghInfo = createSubscription(async (tx) => {
    const appRepo = await AppRepoStore.forApp(tx, ctx.app.id);
    const ghRepos = await GithubRepoStore.all(tx);
    const ghRepo = ghRepos.find((repo) => repo.id === appRepo[0]?.repoID);
    const ghOrgs = await GithubOrgStore.all(tx);
    const ghOrg = ghOrgs.find(
      (org) => org.id === ghRepo?.githubOrgID && !org.time.disconnected,
    );
    return { ghRepo, ghOrg };
  });
  return (
    <>
      <HeaderSlot>
        <Show
          when={ghInfo.value?.ghOrg}
          fallback={
            <Link href="../../settings#repo">
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
              href={`https://github.com/${ghInfo.value!.ghOrg!.login}/${
                ghInfo.value!.ghRepo!.name
              }`}
            >
              <RepoLinkIcon>
                <IconGitHub width="16" height="16" />
              </RepoLinkIcon>
              <RepoLinkCopy>
                {ghInfo.value!.ghOrg!.login}
                <RepoLinkSeparator>/</RepoLinkSeparator>
                {ghInfo.value!.ghRepo!.name}
              </RepoLinkCopy>
            </RepoLink>
          </Stack>
        </Show>
      </HeaderSlot>
      <Routes>
        <Route path="" element={<List />} />
        <Route path=":runID" element={<Detail />} />
        <Route path="*" element={<NotFound inset="header-tabs" />} />
      </Routes>
    </>
  );
}
