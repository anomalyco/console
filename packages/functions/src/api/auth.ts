import { useActor, withActor } from "@console/core/actor";
import { User } from "@console/core/user";
import { VisibleError } from "@console/core/util/error";
import { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { sessions } from "src/sessions";

export const notPublic: MiddlewareHandler = async (c, next) => {
  const actor = useActor();
  if (actor.type === "public")
    throw new HTTPException(401, { message: "Unauthorized" });
  return next();
};

export const auth: MiddlewareHandler = async (c, next) => {
  const authHeader =
    c.req.query("authorization") ?? c.req.header("authorization");
  if (!authHeader) return next();
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    throw new VisibleError(
      "auth.token",
      "Bearer token not found or improperly formatted",
    );
  }
  const bearerToken = match[1];
  let result = await sessions.verify(bearerToken!);

  if (result.type === "public") {
    return withActor({ type: "public", properties: {} }, next);
  }

  if (result.type === "account") {
    const workspaceID = c.req.header("x-sst-workspace");
    if (!workspaceID) return withActor(result, next);
    const email = result.properties.email;
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
          return c.text("Unauthorized");
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
