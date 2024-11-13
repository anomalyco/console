import {
  eq,
  and,
  isNull,
  gt,
  sql,
  getTableColumns,
  or,
  lt,
  isNotNull,
} from "drizzle-orm";
import { useWorkspace } from "../actor";
import { app, stage } from "../app/app.sql";
import { db } from "../drizzle";
import { workspace } from "../workspace/workspace.sql";
import { issue, issueAlertLimit } from "./issue.sql";
import { createSelectSchema } from "drizzle-zod";
import { zod } from "../util/zod";
import { z } from "zod";
import { IssueEmail } from "@console/mail/emails/templates/IssueEmail";
import { IssueRateLimitEmail } from "@console/mail/emails/templates/IssueRateLimitEmail";
import { render } from "@jsx-email/render";
import type { KnownBlock } from "@slack/web-api";
import { Workspace } from "../workspace";
import { Alert } from "../alert";
import { createTransaction } from "../util/transaction";
import { Resource } from "sst";
import { workspaceID } from "../util/sql";

export const Limit = createSelectSchema(issueAlertLimit);

export const triggerIssue = zod(
  z.object({
    stageID: z.string().cuid2(),
    group: z.string(),
  }),
  async (input) => {
    console.log("triggering issue", input);
    const result = await createTransaction(async (tx) => {
      await tx
        .select()
        .from(issue)
        .for("update")
        .where(
          and(
            eq(issue.workspaceID, useWorkspace()),
            eq(issue.stageID, input.stageID),
            eq(issue.group, input.group),
          ),
        );
      return await tx
        .select({
          ...getTableColumns(issue),
          slug: workspace.slug,
          appName: app.name,
          stageName: stage.name,
          workspaceSlug: workspace.slug,
        })
        .from(issue)
        .innerJoin(workspace, eq(workspace.id, issue.workspaceID))
        .innerJoin(
          stage,
          and(
            eq(stage.id, issue.stageID),
            eq(stage.workspaceID, useWorkspace()),
          ),
        )
        .innerJoin(
          app,
          and(eq(app.id, stage.appID), eq(app.workspaceID, useWorkspace())),
        )
        .leftJoin(
          issueAlertLimit,
          and(
            eq(issueAlertLimit.workspaceID, useWorkspace()),
            eq(issueAlertLimit.id, issue.id),
          ),
        )
        .where(
          and(
            isNull(workspace.timeDeleted),
            eq(issue.workspaceID, useWorkspace()),
            eq(issue.stageID, input.stageID),
            eq(issue.group, input.group),
            or(
              // alert first time
              isNull(issueAlertLimit.timeUpdated),
              // do not alert more than once every 30min
              lt(issueAlertLimit.timeUpdated, sql`NOW() - INTERVAL 30 MINUTE`),
              // if issue resolved after last alert, send alert
              and(
                isNotNull(issue.timeResolved),
                gt(issue.timeResolved, issueAlertLimit.timeUpdated),
              ),
            ),
            isNull(issue.timeIgnored),
          ),
        )
        .then((rows) => rows[0]);
    });

    if (!result) {
      console.log("not alertable");
      return;
    }

    console.log("alerting", result.id);

    const alerts = await Alert.list({
      app: result.appName,
      stage: result.stageName,
      events: ["issue"],
    });

    console.log("alerts", alerts.length);

    for (const alert of alerts) {
      const { destination } = alert;

      if (destination.type === "slack") {
        const context = (function () {
          const match = result.stack?.find((frame) => frame.important);
          if (!match?.context) return;
          const offset = Math.max(1, match.line! - 3);
          const active = Math.min(3, match.line! - 1);
          const max = (offset + match.context.length - 1).toString().length;
          return [
            "# " + match.file,
            "-",
            ...match.context.map((line, index) => {
              return `${(index + offset)
                .toString()
                .padStart(max, " ")}  ${line}`;
            }),
          ].join("\n");
        })();
        const blocks: KnownBlock[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `*<https://console.sst.dev/${result.slug}/${result.appName}/${result.stageName}/issues/${result.id} | ${result.error}>*`,
                result.message.substring(0, 2000),
                "_" + [result.appName, result.stageName].join(" / ") + "_",
              ].join("\n"),
            },
          },
        ];

        // insert into position 1
        if (context) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: ["```", context, "```"].join("\n"),
            },
          });
        }
        await Alert.sendSlack({
          stageID: input.stageID,
          alertID: alert.id,
          destination,
          blocks,
          text: `${result.error}: ${result.message.substring(0, 512)}`,
        });
      }

      if (destination.type === "email") {
        await Alert.sendEmail({
          destination,
          subject: `Error: ${encodeURIComponent(result.error)}`,
          html: render(
            // @ts-ignore
            IssueEmail({
              issue: result,
              stage: result.stageName,
              app: result.appName,
              assetsUrl: `https://console.sst.dev/email`,
              consoleUrl: "https://console.sst.dev",
              workspace: result.workspaceSlug,
            }),
          ),
          plain: result.message,
          replyToAddress: `alert+issues+${result.id}@${Resource.Email.sender}`,
          fromAddress: `${result.appName}/${result.stageName} via SST <alert+issues+${result.id}@${Resource.Email.sender}>`,
        });
      }
    }

    if (alerts.length)
      await db
        .insert(issueAlertLimit)
        .values({
          id: result.id,
          workspaceID: useWorkspace(),
        })
        .onDuplicateKeyUpdate({
          set: {
            timeUpdated: sql`NOW()`,
          },
        });
  },
);

export const triggerRateLimit = zod(
  z.object({
    app: z.string(),
    stage: z.string(),
    stageID: z.string().cuid2(),
  }),
  async (input) => {
    const alerts = await Alert.list({
      app: input.app,
      stage: input.stage,
      events: ["issue"],
    });

    for (const alert of alerts) {
      const { destination } = alert;

      const workspaceID = useWorkspace();
      const workspace = await Workspace.fromID(workspaceID);
      const message =
        "Some of your functions hit a soft limit for the number of issues per hour. You can re-enable them or contact us to lift the limit.";

      if (destination.type === "slack") {
        const link = `https://console.sst.dev/${workspace!.slug}/${input.app}/${
          input.stage
        }/issues`;
        const blocks: KnownBlock[] = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                message,
                `*<${link} | Enable Issues>*`,
                "_" + [input.app, input.stage].join(" / ") + "_",
              ].join("\n"),
            },
          },
        ];

        await Alert.sendSlack({
          stageID: input.stageID,
          alertID: alert.id,
          destination,
          blocks,
          text: message,
        });
      }

      if (destination.type === "email") {
        const subject = "Issues temporarily disabled";
        await Alert.sendEmail({
          destination,
          subject,
          html: render(
            // @ts-ignore
            IssueRateLimitEmail({
              stage: input.stage,
              app: input.app,
              subject,
              message,
              assetsUrl: `https://console.sst.dev/email`,
              consoleUrl: "https://console.sst.dev",
              workspace: workspace!.slug,
            }),
          ),
          plain: message,
          replyToAddress: `alert+issues@${process.env.EMAIL_DOMAIN}`,
          fromAddress: `${input.app}/${input.stage} via SST <alert+issues@${process.env.EMAIL_DOMAIN}>`,
        });
      }
    }
  },
);
