import { Actor, withActor, useActor } from "@console/core/actor";
import { useHeader, Response } from "sst/node/api";
import { User } from "@console/core/user";
import { sessions } from "./sessions";

export const withApiAuth = <T>(cb: () => Promise<T>) => {
  return function () {
    const session = sessions.use();

    const workspaceID = useHeader("x-sst-workspace");
    if (!workspaceID) return withActor(session, cb);
    if (session.type !== "account")
      throw new Response({
        statusCode: 401,
        body: "Unauthorized",
      });

    const result = withActor(
      {
        type: "system",
        properties: {
          workspaceID,
        },
      },
      async () => {
        const user = await User.fromEmail(session.properties.email);
        if (!user || user.timeDeleted)
          throw new Response({
            statusCode: 401,
            body: "Unauthorized",
          });
        return withActor(
          {
            type: "user",
            properties: {
              workspaceID,
              userID: user.id,
            },
          },
          cb,
        );
      },
    );
    return result;
  };
};

export function NotPublic() {
  const actor = useActor();
  if (actor.type === "public")
    throw new Response({
      statusCode: 401,
      body: "Unauthorized",
    });
}
