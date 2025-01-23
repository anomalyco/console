import { withActor } from "@console/core/actor";
import { sessions } from "./sessions";
import { User } from "@console/core/user/index";
import { db, eq, sql } from "@console/core/drizzle/index";
import { user } from "@console/core/user/user.sql";

export async function handler(event: any) {
  const token = event.authorizationToken;
  const session = await sessions.verify(token).catch(() => undefined);
  if (!session) return { isAuthorized: false };
  if (session.type !== "account") return { isAuthorized: false };
  if (event.requestContext.operation === "EVENT_CONNECT") {
    await db
      .update(user)
      .set({
        timeSeen: sql`now()`,
      })
      .where(eq(user.email, session.properties.email))
      .execute();
    return { isAuthorized: true };
  }
  const workspaceID = event.requestContext.channel.split("/").at(2)!;
  return withActor(
    {
      type: "system",
      properties: {
        workspaceID,
      },
    },
    async () => {
      const user = await User.fromEmail(session.properties.email);
      if (!user || user.timeDeleted) {
        return { isAuthorized: false };
      }
      return { isAuthorized: true };
    },
  );
}
