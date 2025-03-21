import { useActor, withActor } from "@console/core/actor";
import { User } from "@console/core/user/index";
import { VisibleError } from "@console/core/util/error";
import { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { createClient } from "@openauthjs/openauth/client";
import { Resource } from "sst";
import { subjects } from "../subjects";

const client = createClient({
  issuer: Resource.OpenAuth.url,
  clientID: "console",
});

export const notPublic: MiddlewareHandler = async (c, next) => {
  const actor = useActor();
  if (actor.type === "public")
    throw new HTTPException(401, { message: "Unauthorized" });
  return next();
};

export const auth: MiddlewareHandler = async (c, next) => {
  const authHeader =
    c.req.query("authorization") ?? c.req.header("authorization");
  if (!authHeader) return withActor({ type: "public", properties: {} }, next);
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new VisibleError(
      "auth.token",
      "Bearer token not found or improperly formatted",
    );
  }
  const bearerToken = match[1];
  let result = await client.verify(subjects, bearerToken!);
  if (result.err) {
    console.error(result.err);
    throw new HTTPException(401, {
      message: "Unauthorized: " + result.err.message,
    });
  }

  if (result.subject.type === "account") {
    const workspaceID =
      c.req.header("x-sst-workspace") || c.req.query("workspaceID");
    if (!workspaceID) return withActor(result.subject, next);
    const email = result.subject.properties.email;
    return withActor(
      {
        type: "system",
        properties: {
          workspaceID,
        },
      },
      async () => {
        const user = await User.fromEmail(email);
        if (!user || user.timeDeleted) {
          c.status(401);
          return c.text("Unauthorized: User not found");
        }
        return withActor(
          {
            type: "user",
            properties: { userID: user.id, workspaceID: user.workspaceID },
          },
          next,
        );
      },
    );
  }
};
