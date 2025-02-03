import { withActor } from "@console/core/actor";
import { User } from "@console/core/user/index";
import { db, eq, sql } from "@console/core/drizzle/index";
import { user } from "@console/core/user/user.sql";
import { createClient } from "@openauthjs/openauth";
import { Resource } from "sst";
import { subjects } from "./subjects";

const client = createClient({
  issuer: Resource.OpenAuth.url,
  clientID: "socket",
});

export async function handler(event: any) {
  const token = event.authorizationToken;
  const verified = await client.verify(subjects, token);
  if (verified.err) return { isAuthorized: false };
  if (verified.subject.type !== "account") return { isAuthorized: false };
  if (event.requestContext.operation === "EVENT_CONNECT") {
    await db
      .update(user)
      .set({
        timeSeen: sql`now()`,
      })
      .where(eq(user.email, verified.subject.properties.email))
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
      const user = await User.fromEmail(verified.subject.properties.email);
      if (!user || user.timeDeleted) {
        return { isAuthorized: false };
      }
      return { isAuthorized: true };
    },
  );
}
