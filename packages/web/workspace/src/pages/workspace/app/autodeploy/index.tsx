import { useAppContext } from "../context";
import { Show } from "solid-js";
import { Link, Route, Routes } from "@solidjs/router";
import { styled } from "@macaron-css/solid";
import { Header, PageHeader } from "../../header";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { createSubscription } from "$/providers/replicache";
import {
  RunStore,
  AppRepoStore,
  GithubOrgStore,
  GithubRepoStore,
} from "$/data/app";
import { DateTime } from "luxon";
import { IconGitHub } from "$/ui/icons/custom";
import { TabTitle, ButtonIcon } from "$/ui/button";
import { Row, Stack } from "$/ui/layout";
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
  const ctx = useAppContext();
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
  return (
    <>
      <Header app={ctx.app.name} />
      <Show when={r.value!}>
        <PageHeader>
          <Row space="5" vertical="center">
            <Link href="../">
              <TabTitle size="sm">Stages</TabTitle>
            </Link>
            <Link href="">
              <TabTitle size="sm" count={r.value!.latestRunError ? "•" : ""}>
                Autodeploy
              </TabTitle>
            </Link>
            <Link href="../settings">
              <TabTitle size="sm">Settings</TabTitle>
            </Link>
          </Row>
          <Show
            when={r.value!.ghRepoOrg}
            fallback={
              <Link href="../settings#repo">
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
                href={`https://github.com/${r.value!.ghRepoOrg!.login}/${
                  r.value!.ghRepo!.name
                }`}
              >
                <RepoLinkIcon>
                  <IconGitHub width="16" height="16" />
                </RepoLinkIcon>
                <RepoLinkCopy>
                  {r.value!.ghRepoOrg!.login}
                  <RepoLinkSeparator>/</RepoLinkSeparator>
                  {r.value!.ghRepo!.name}
                </RepoLinkCopy>
              </RepoLink>
            </Stack>
          </Show>
        </PageHeader>
        <Routes>
          <Route path="" element={<List />} />
          <Route path=":runID" element={<Detail />} />
          <Route path="*" element={<NotFound inset="header-tabs" />} />
        </Routes>
      </Show>
    </>
  );
}
