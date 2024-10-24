import { Server } from "./framework";
import { App, Stage } from "@console/core/app";
import { LogPoller } from "@console/core/log/poller";
import { Log } from "@console/core/log/";
import { AWS } from "@console/core/aws";
import { z } from "zod";
import { Workspace } from "@console/core/workspace";
import { Lambda } from "@console/core/lambda";
import { assertActor, withActor, useWorkspace } from "@console/core/actor";
import { User } from "@console/core/user";
import { Issue } from "@console/core/issue";
import { and, eq, or } from "@console/core/drizzle";
import { useTransaction } from "@console/core/util/transaction";
import { issueSubscriber } from "@console/core/issue/issue.sql";
import { warning } from "@console/core/warning/warning.sql";
import { Github } from "@console/core/git/github";
import { Slack } from "@console/core/slack";
import { AppRepo } from "@console/core/app/repo";
import { RunConfig } from "@console/core/run/config";
import { Alert } from "@console/core/alert";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

export const server = new Server()
  .expose("log_poller_subscribe", LogPoller.subscribe)
  .expose("log_search", Log.Search.search)
  .expose("function_invoke", Lambda.invoke)
  .expose("function_payload_save", Lambda.savePayload)
  .expose("function_payload_remove", Lambda.removePayload)
  .expose("issue_ignore", Issue.ignore)
  .expose("issue_unignore", Issue.unignore)
  .expose("issue_resolve", Issue.resolve)
  .expose("issue_unresolve", Issue.unresolve)
  .expose("alert_put", Alert.put)
  .expose("alert_remove", Alert.remove)
  .expose("github_disconnect", Github.disconnect)
  .expose("slack_disconnect", Slack.disconnect)
  .expose("workspace_remove", Workspace.remove)
  .mutation("aws_account_remove", z.string(), async (input) => {
    await AWS.Account.disconnect(input);
    const account = await AWS.Account.fromID(input);
    if (!account) return;
    const credentials = await AWS.assumeRole(account.accountID);
    if (!credentials) {
      return;
    }
    await AWS.Account.disintegrate({
      awsAccountID: input,
      credentials,
    });
  })
  .mutation(
    "issue_subscribe",
    z.object({
      stageID: z.string(),
    }),
    async (input) => {
      await useTransaction(async (tx) => {
        await tx
          .delete(issueSubscriber)
          .where(
            and(
              eq(issueSubscriber.workspaceID, useWorkspace()),
              eq(issueSubscriber.stageID, input.stageID),
            ),
          )
          .execute();
        await tx
          .delete(warning)
          .where(
            and(
              eq(warning.workspaceID, useWorkspace()),
              eq(warning.stageID, input.stageID),
              or(
                eq(warning.type, "log_subscription"),
                eq(warning.type, "issue_rate_limited"),
              ),
            ),
          )
          .execute();
      });
      await bus.publish(Resource.Bus, Stage.Events.ResourcesUpdated, {
        stageID: input.stageID,
      });
    },
  )
  .expose("aws_account_scan", AWS.Account.scan)
  .mutation("app_stage_sync", z.object({ stageID: z.string() }), (input) =>
    bus.publish(Resource.Bus, App.Stage.Events.Updated, input),
  )
  .mutation("workspace_create", Workspace.create.schema, async (input) => {
    const actor = assertActor("account");
    const workspace = await Workspace.create(input);
    await withActor(
      {
        type: "system",
        properties: {
          workspaceID: workspace,
        },
      },
      () =>
        User.create({
          email: actor.properties.email,
          first: true,
        }),
    );
  })
  .expose("user_create", User.create)
  .expose("user_remove", User.remove)
  .expose("app_create", App.create)
  .expose("app_repo_connect", AppRepo.connect)
  .expose("app_repo_disconnect", AppRepo.disconnect)
  .expose("app_repo_path_put", AppRepo.putPath)
  .expose("run_config_put", RunConfig.put)
  .expose("run_config_remove", RunConfig.remove);

export type ServerType = typeof server;
