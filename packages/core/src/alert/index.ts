import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, inArray, isNull, isNotNull } from "drizzle-orm";
import { useWorkspace } from "../actor";
import { zod } from "../util/zod";
import { useTransaction } from "../util/transaction";
import { z } from "zod";
import { warning } from "../warning/warning.sql";
import { Event, alert } from "./alert.sql";
import { db } from "../drizzle";
import { user } from "../user/user.sql";
import { Slack } from "../slack";
import type { KnownBlock, MessageAttachment } from "@slack/web-api";
import { Warning } from "../warning";
const ses = new SESv2Client({});

export module Alert {
  export const Info = z.object({
    id: z.string().cuid2(),
    source: z.custom<Source>(),
    destination: z.custom<Destination>(),
    event: z.enum(Event).default("issue"),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
    }),
  });
  export type Info = z.infer<typeof Info>;

  export interface Source {
    app: "*" | string[];
    stage: "*" | string[];
  }

  export type Destination = SlackDestination | EmailDestination;

  export interface SlackDestination {
    type: "slack";
    properties: {
      channel: string;
    };
  }

  export interface EmailDestination {
    type: "email";
    properties: {
      users: "*" | string[];
    };
  }

  export function serialize(input: typeof alert.$inferSelect): Info {
    return {
      id: input.id,
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
      },
      source: input.source,
      destination: input.destination,
      event: input.event ?? "issue",
    };
  }

  export const list = zod(
    z.object({
      app: z.string(),
      stage: z.string().optional(),
      events: z.array(z.enum(Event)),
    }),
    async ({ app, stage, events }) => {
      const alerts = await useTransaction((tx) =>
        tx
          .select()
          .from(alert)
          .where(eq(alert.workspaceID, useWorkspace()))
          .execute(),
      );
      return alerts.filter(
        (alert) =>
          (alert.source.app === "*" || alert.source.app.includes(app)) &&
          (!stage ||
            alert.source.stage === "*" ||
            alert.source.stage.includes(stage)) &&
          events.includes(alert.event ?? "issue"),
      );
    },
  );

  export const put = zod(
    z.object({
      id: Info.shape.id.optional(),
      source: Info.shape.source,
      destination: Info.shape.destination,
      event: Info.shape.event,
    }),
    (input) =>
      useTransaction(async (tx) => {
        const id = input.id ?? createId();
        await tx
          .insert(alert)
          .values({
            id,
            workspaceID: useWorkspace(),
            source: input.source,
            destination: input.destination,
            event: input.event,
          })
          .onDuplicateKeyUpdate({
            set: {
              source: input.source,
              destination: input.destination,
              event: input.event,
            },
          });
        await tx
          .delete(warning)
          .where(
            and(
              eq(warning.workspaceID, useWorkspace()),
              eq(warning.type, "issue_alert_slack"),
              eq(warning.target, id),
            ),
          );
        return id;
      }),
  );

  export const remove = zod(Info.shape.id, (input) =>
    useTransaction((tx) =>
      tx
        .delete(alert)
        .where(and(eq(alert.id, input), eq(alert.workspaceID, useWorkspace()))),
    ),
  );

  export const sendSlack = zod(
    z.object({
      stageID: z.string().cuid2().optional(),
      alertID: z.string().cuid2(),
      destination: z.custom<SlackDestination>(),
      blocks: z.array(z.custom<KnownBlock>()),
      attachments: z.array(z.custom<MessageAttachment>()).optional(),
      text: z.string().min(1),
    }),
    async ({ stageID, alertID, destination, blocks, attachments, text }) => {
      try {
        console.log("sending slack");
        await Slack.send({
          channel: destination.properties.channel,
          blocks,
          attachments,
          text,
        });
        if (stageID)
          await Warning.remove({
            stageID,
            type: "issue_alert_slack",
            target: alertID,
          });
      } catch {
        if (stageID)
          await Warning.create({
            stageID,
            type: "issue_alert_slack",
            target: alertID,
            data: {
              channel: destination.properties.channel,
            },
          });
      }
    },
  );
  export const sendEmail = zod(
    z.object({
      destination: z.custom<EmailDestination>(),
      subject: z.string().min(1),
      html: z.string().min(1),
      plain: z.string().min(1),
      replyToAddress: z.string().min(1),
      fromAddress: z.string().min(1),
    }),
    ({ destination, subject, html, plain, replyToAddress, fromAddress }) =>
      useTransaction(async (tx) => {
        const users = await db
          .select({ email: user.email })
          .from(user)
          .where(
            and(
              eq(user.workspaceID, useWorkspace()),
              destination.properties.users === "*"
                ? undefined
                : inArray(user.id, destination.properties.users),
              isNull(user.timeDeleted),
              isNotNull(user.timeSeen),
            ),
          );
        console.log(
          "sending email to",
          users.map((u) => u.email),
          "from",
          fromAddress,
        );
        if (!users.length) return;

        try {
          await ses.send(
            new SendEmailCommand({
              Destination: {
                ToAddresses: users.map((u) => u.email),
              },
              ReplyToAddresses: [replyToAddress],
              FromEmailAddress: fromAddress,
              Content: {
                Simple: {
                  Body: {
                    Html: { Data: html },
                    Text: { Data: plain },
                  },
                  Subject: { Data: subject },
                },
              },
            }),
          );
        } catch (ex) {
          console.error(ex);
        }
        return;
      }),
  );
}
