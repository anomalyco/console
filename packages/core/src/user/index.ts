export * as User from "./";

import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { zod } from "../util/zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "../drizzle";
import { and, eq, sql } from "drizzle-orm";
import { createTransactionEffect, useTransaction } from "../util/transaction";
import { user } from "./user.sql";
import { useActor, useWorkspace } from "../actor";
import { createEvent } from "../event";
import { render } from "@jsx-email/render";
import { InviteEmail } from "@console/mail/emails/templates/InviteEmail";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { workspace } from "../workspace/workspace.sql";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

const ses = new SESv2Client({});

export const Info = createSelectSchema(user, {
  id: (schema) => schema.id.cuid2(),
  email: (schema) => schema.email.trim().toLowerCase().min(1),
  workspaceID: (schema) => schema.workspaceID.cuid2(),
});
export type Info = z.infer<typeof Info>;

export const Events = {
  UserCreated: createEvent(
    "user.created",
    z.object({
      userID: z.string().cuid2(),
    }),
  ),
};

export function list() {
  return useTransaction((tx) =>
    tx
      .select()
      .from(user)
      .where(eq(user.workspaceID, useWorkspace()))
      .execute(),
  );
}

export const create = zod(
  Info.pick({ email: true, id: true })
    .partial({
      id: true,
    })
    .extend({
      first: z.boolean().optional(),
    }),
  (input) =>
    useTransaction(async (tx) => {
      await tx
        .insert(user)
        .values({
          id: input.id ?? createId(),
          email: input.email,
          workspaceID: useWorkspace(),
          timeSeen: input.first ? sql`CURRENT_TIMESTAMP()` : null,
        })
        .onDuplicateKeyUpdate({
          set: {
            timeDeleted: null,
          },
        })
        .execute();
      const id = await tx
        .select({
          id: user.id,
        })
        .from(user)
        .where(
          and(
            eq(user.email, input.email),
            eq(user.workspaceID, useWorkspace()),
          ),
        )
        .then((rows) => rows[0]!.id);
      await createTransactionEffect(() =>
        bus.publish(Resource.Bus, Events.UserCreated, { userID: id }),
      );
      return id;
    }),
);

export const remove = zod(Info.shape.id, (input) =>
  useTransaction(async (tx) => {
    await tx
      .update(user)
      .set({
        timeDeleted: sql`CURRENT_TIMESTAMP()`,
      })
      .where(and(eq(user.id, input), eq(user.workspaceID, useWorkspace())))
      .execute();
    return input;
  }),
);

export const fromID = zod(Info.shape.id, async (id) =>
  db.transaction(async (tx) => {
    return tx
      .select()
      .from(user)
      .where(and(eq(user.id, id), eq(user.workspaceID, useWorkspace())))
      .execute()
      .then((rows) => rows[0]);
  }),
);

export const fromEmail = zod(Info.shape.email, async (email) =>
  db.transaction(async (tx) => {
    return tx
      .select()
      .from(user)
      .where(and(eq(user.email, email), eq(user.workspaceID, useWorkspace())))
      .execute()
      .then((rows) => rows[0]);
  }),
);

export function findUser(workspaceID: string, email: string) {
  return useTransaction(async (tx) => {
    return tx
      .select()
      .from(user)
      .where(and(eq(user.email, email), eq(user.workspaceID, workspaceID)))
      .execute()
      .then((rows) => rows[0]);
  });
}

export const sendEmailInvite = zod(Info.shape.id, async (id) => {
  const actor = useActor();
  if (actor.type !== "user") return;
  const data = await db
    .select({
      workspace: workspace.slug,
      email: user.email,
    })
    .from(user)
    .innerJoin(workspace, eq(workspace.id, user.workspaceID))
    .where(and(eq(user.id, id), eq(user.workspaceID, useWorkspace())))
    .then((rows) => rows[0]);
  if (!data) return;
  const subject = `Join ${data.workspace} on SST`;
  const html = render(
    // @ts-ignore
    InviteEmail({
      assetsUrl: `https://console.sst.dev/email`,
      workspace: data.workspace,
      consoleUrl: `https://console.sst.dev`,
    }),
  );
  try {
    await ses.send(
      new SendEmailCommand({
        Destination: {
          ToAddresses: [data.email],
        },
        ReplyToAddresses: [`invite@${process.env.EMAIL_DOMAIN}`],
        FromEmailAddress: `SST <invite@${process.env.EMAIL_DOMAIN}>`,
        Content: {
          Simple: {
            Body: {
              Html: {
                Data: html,
              },
              Text: {
                Data: html,
              },
            },
            Subject: {
              Data: subject,
            },
          },
        },
      }),
    );
  } catch (ex) {
    console.error(ex);
  }
});
