import type { App } from "@console/core/app/index";
import { Store } from "./store";
import type { Github } from "@console/core/git/github";
import type { Slack } from "@console/core/slack/index";
import type { Billing } from "@console/core/billing/index";
import type { AppRepo } from "@console/core/app/repo";
import type { State } from "@console/core/state/index";
import type { Run } from "@console/core/run/index";
import type { RunConfig } from "@console/core/run/config";
import { ReadTransaction } from "replicache";
import { Alert } from "@console/core/alert/index";

export const AppStore = new Store()
  .type<App.Info>()
  .scan("all", () => ["app"])
  .get((id: string) => ["app", id])
  .build();

export const AppRepoStore = new Store()
  .type<AppRepo.Repo>()
  .scan("all", () => ["appRepo"])
  .get((appID: string, id: string) => ["appRepo", appID, id])
  .scan("forApp", (appID: string) => ["appRepo", appID])
  .build();

export const RunConfigStore = new Store()
  .type<RunConfig.Info>()
  .scan("all", () => ["runConfig"])
  .get((appID: string, id: string) => ["runConfig", appID, id])
  .scan("forApp", (appID: string) => ["runConfig", appID])
  .build();

export const GithubOrgStore = new Store()
  .type<Github.Org>()
  .scan("all", () => ["githubOrg"])
  .get((id: string) => ["githubOrg", id])
  .build();

export const GithubRepoStore = new Store()
  .type<Github.Repo>()
  .scan("all", () => ["githubRepo"])
  .get((id: string) => ["githubRepo", id])
  .build();

export const SlackTeamStore = new Store()
  .type<Slack.Info>()
  .scan("all", () => ["slackTeam"])
  .get((id: string) => ["slackTeam", id])
  .build();

export const AlertStore = new Store()
  .type<Alert.Info>()
  .scan("all", () => ["alert"])
  .get((id: string) => ["alert", id])
  .build();

export const StripeStore = new Store()
  .type<Billing.Stripe.Info>()
  .get(() => ["stripe"])
  .build();

export const StateUpdateStore = new Store()
  .type<State.Update>()
  .scan("forStage", (stageID: string) => ["stateUpdate", stageID])
  .get((stageID: string, issueID: string) => ["stateUpdate", stageID, issueID])
  .build();

export const StateResourceStore = new Store()
  .type<State.Resource>()
  .scan("forStage", (stageID: string) => ["stateResource", stageID])
  .get((stageID: string, id: string) => ["stateResource", stageID, id])
  .build();

export const StateEventStore = new Store()
  .type<State.ResourceEvent>()
  .scan("forStage", (stageID: string) => ["stateEvent", stageID])
  .scan("forUpdate", (stageID: string, updateID: string) => [
    "stateEvent",
    stageID,
    updateID,
  ])
  .get((stageID: string, updateID: string, resourceID: string) => [
    "stateEvent",
    stageID,
    updateID,
    resourceID,
  ])
  .build();

export const RunStore = new Store()
  .type<Run.Run>()
  .scan("all", () => ["run/"])
  .get((runID: string) => ["run", runID])
  .build();

export function RepoFromApp(id: string) {
  return async (tx: ReadTransaction) => {
    const appRepo = await AppRepoStore.forApp(tx, id);
    if (!appRepo.length) return;
    const repo = await GithubRepoStore.get(tx, appRepo[0].repoID);
    const org = await GithubOrgStore.get(tx, repo.githubOrgID);
    return { repo, org };
  };
}
