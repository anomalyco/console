import { DateTime } from "luxon";
import { createMemo, Show, Switch, Match, Suspense } from "solid-js";
import { styled } from "@macaron-css/solid";
import { A, useMatch } from "@solidjs/router";

import { theme } from "$/ui/theme";
import { Button } from "$/ui/button";
import { utility } from "$/ui/utility";
import { Row } from "$/ui/layout";
import {
  RunStore,
  AppRepoStore,
  GithubOrgStore,
  GithubRepoStore,
} from "$/data/app";
import { IconGitHub } from "$/ui/icons/custom";
import { TabTitle, ButtonIcon } from "$/ui/button";
import { createSubscription, useReplicache } from "$/providers/replicache";

import { Header } from "../header";
import { useWorkspace } from "../context";
import { useAppContext } from "./context";
import { DialogDeploy, DialogDeployControl } from "./autodeploy/dialog-deploy";
import {
  DialogRedeploy,
  DialogRedeployControl,
} from "./autodeploy/dialog-redeploy";

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
    alignItems: "center",
    gap: 5,
    color: theme.color.text.secondary.base,
    fontSize: theme.font.size.sm,
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
        color: theme.color.link.primary.hover,
      },
    },
  },
});

export function PageHeader() {
  let deployControl!: DialogDeployControl;
  let redeployControl!: DialogRedeployControl;

  const isAutodeploy = useMatch(() => ":workspace/:app/autodeploy");
  const isAutodeployDetail = useMatch(
    () => ":workspace/:app/autodeploy/:runID",
  );

  const runID = () => isAutodeployDetail()?.params.runID;
  const ctx = useAppContext();
  const rep = useReplicache();
  const workspace = useWorkspace();
  const r = createSubscription(() => {
    const appID = ctx.app.id;
    return async (tx) => {
      const runs = await RunStore.all(tx);
      const run = runs
        .filter((run) => run.appID === appID)
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

      const currentRun = runID()
        ? runs.find((run) => run.id === runID())
        : undefined;

      return {
        ghRepo,
        ghRepoOrg,
        currentRun,
        latestRunError,
      };
    };
  });

  const appUrl = createMemo(() => `/${workspace().slug}/${ctx.app.name}`);

  return (
    <>
      <Header app={ctx.app.name} />
      <PageHeaderRoot>
        <Show when={r.value!}>
          <Suspense>
            <Row space="5" vertical="center">
              <A end href={appUrl()}>
                <TabTitle size="sm">Stages</TabTitle>
              </A>
              <A href={`${appUrl()}/autodeploy`}>
                <TabTitle size="sm" count={r.value!.latestRunError ? "•" : ""}>
                  Autodeploy
                </TabTitle>
              </A>
              <A href={`${appUrl()}/settings`}>
                <TabTitle size="sm">Settings</TabTitle>
              </A>
            </Row>
            <Row space="3">
              <Show
                when={r.value!.ghRepoOrg}
                fallback={
                  <A href={`${appUrl()}/settings#repo`}>
                    <Button color="secondary" size="sm">
                      <ButtonIcon size="sm">
                        <IconGitHub />
                      </ButtonIcon>
                      Connect Repo
                    </Button>
                  </A>
                }
              >
                <Show when={!Boolean(isAutodeployDetail())}>
                  <RepoLink
                    target="_blank"
                    href={`https://github.com/${r.value!.ghRepoOrg!.login}/${r.value!.ghRepo!.name
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
                </Show>
                <Switch>
                  <Match when={Boolean(isAutodeploy())}>
                    <Button
                      size="sm"
                      color="secondary"
                      onClick={() => deployControl.show()}
                    >
                      Deploy
                    </Button>
                  </Match>
                  <Match when={Boolean(isAutodeployDetail())}>
                    <Switch>
                      <Match
                        when={
                          r.value!.currentRun &&
                          ["queued", "updating"].includes(
                            r.value!.currentRun?.status,
                          )
                        }
                      >
                        <Button
                          size="sm"
                          color="warning"
                          onClick={async () => {
                            runID() &&
                              (await rep().mutate.run_cancel({
                                runID: runID()!,
                              }));
                          }}
                        >
                          Cancel
                        </Button>
                      </Match>
                      <Match when={true}>
                        <Button
                          size="sm"
                          color="secondary"
                          onClick={() => redeployControl.show()}
                        >
                          Redeploy
                        </Button>
                      </Match>
                    </Switch>
                  </Match>
                </Switch>
              </Show>
            </Row>
          </Suspense>
        </Show>
      </PageHeaderRoot>
      <DialogDeploy control={(control) => (deployControl = control)} />
      <DialogRedeploy
        runID={runID()!}
        control={(control) => (redeployControl = control)}
      />
    </>
  );
}
