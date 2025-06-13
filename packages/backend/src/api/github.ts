import { Hono } from "hono";
import { App } from "octokit";
import { HTTPException } from "hono/http-exception";
import { withActor } from "@console/core/actor";
import { Github } from "@console/core/git/github";
import { Resource } from "sst";
import { Run } from "@console/core/run/index";

export const GithubRoute = new Hono();

GithubRoute.get("/installed", async (c) => {
  const workspaceID = c.req.query("state");
  const installationID = parseInt(c.req.query("installation_id") ?? "");

  if (!installationID)
    throw new HTTPException(401, { message: "Unauthorized" });

  // User has authorized the app
  if (workspaceID) {
    await withActor(
      {
        type: "system",
        properties: {
          workspaceID,
        },
      },
      async () => {
        await Github.connect(installationID);
        await Github.syncRepos(installationID);
      },
    );
  }

  // No workspaceID when the installation is updated from GitHub console
  if (!workspaceID) {
    await withActor({ type: "public", properties: {} }, async () => {
      await Github.syncRepos(installationID);
    });
  }

  return c.html(`
<html>
  <script>
    if (window.opener) {
      window.opener.postMessage("github.success", "*")
      window.close()
    }
  </script>`);
});

GithubRoute.get("/connect", async (c) => {
  const workspaceID = c.req.query("workspaceID");
  const appName =
    Resource.App.stage === "production"
      ? "sst-console"
      : `sst-console-${Resource.App.stage}`;
  return c.redirect(
    `https://github.com/apps/${appName}/installations/new?state=${workspaceID}`,
  );
});

GithubRoute.post("/webhook", async (c) => {
  const ret = await app.webhooks.verifyAndReceive({
    id: c.req.header("x-github-delivery")!,
    name: c.req.header("x-github-event") as any,
    signature: c.req.header("x-hub-signature-256")!,
    payload: await c.req.text(),
  });

  return c.text("ok");
});

const app = new App({
  appId: Resource.GithubAppID.value,
  privateKey: Resource.GithubPrivateKey.value,
  webhooks: {
    secret: Resource.GithubWebhookSecret.value,
  },
});
app.webhooks.on("installation.deleted", async (event) => {
  const installationID = event.payload.installation.id;
  await Github.disconnectAll(installationID);
});

app.webhooks.on(
  ["pull_request.opened", "pull_request.synchronize", "pull_request.closed"],
  async (event) => {
    const commitID = event.payload.pull_request.head.sha;
    const owner = event.payload.repository.owner!.login;
    const repo = event.payload.repository.name;
    const commit = await event.octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitID,
    });
    await Run.triggerGitDeploy({
      octokit: event.octokit,
      trigger: {
        source: "github",
        type: "pull_request",
        action: event.payload.action === "closed" ? "removed" : "pushed",
        repo: {
          id: event.payload.repository.id,
          owner,
          repo,
        },
        number: event.payload.number,
        title: event.payload.pull_request.title?.substring(0, 100),
        base: event.payload.pull_request.base.ref.replace("refs/heads/", ""),
        head: event.payload.pull_request.head.ref.replace("refs/heads/", ""),
        commit: {
          id: commitID,
          message: commit.data.commit.message?.substring(0, 100)!,
        },
        sender: {
          id: event.payload.sender?.id!,
          username: event.payload.sender?.login!,
        },
      },
    });
  },
);

app.webhooks.on("push", async (event) => {
  const owner = event.payload.repository.owner!.login;
  const repo = event.payload.repository.name;
  const isTag = event.payload.ref.startsWith("refs/tags/");
  await Run.triggerGitDeploy({
    octokit: event.octokit,
    trigger: {
      source: "github",
      ...(isTag
        ? {
            type: "tag",
            tag: event.payload.ref.replace("refs/tags/", ""),
          }
        : {
            type: "branch",
            branch: event.payload.ref.replace("refs/heads/", ""),
          }),
      action: event.payload.deleted ? "removed" : "pushed",
      repo: {
        id: event.payload.repository.id,
        owner,
        repo,
      },
      commit: event.payload.deleted
        ? await (() =>
            event.octokit.rest.repos
              .getCommit({
                owner,
                repo,
                ref: event.payload.before,
              })
              .then((res) => ({
                id: event.payload.before,
                message: res.data.commit.message?.substring(0, 100)!,
              })))()
        : {
            id: event.payload.head_commit?.id!,
            message: event.payload.head_commit?.message?.substring(0, 100)!,
          },
      sender: {
        id: event.payload.sender?.id!,
        username: event.payload.sender?.login!,
      },
    },
  });
});
