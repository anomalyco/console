import { z } from "zod";
import { zod } from "../util/zod";
import { Resource } from "sst";
import { logger } from "../util/log";
import { User } from "../user";

export namespace EmailOctopus {
  const log = logger({
    service: "email-octopus",
  });
  export const subscribe = zod(
    z.object({
      userID: z.string(),
    }),
    async (input) => {
      if (Resource.EmailOctopusSecret.value === "disabled") return;
      const user = await User.fromID(input.userID);
      if (!user) return;
      const response = await fetch(
        `https://emailoctopus.com/api/1.6/lists/28a43870-ee3c-11ef-bebf-b194b5c89918/contacts`,
        {
          method: "POST",
          body: JSON.stringify({
            api_key: Resource.EmailOctopusSecret.value,
            email_address: user?.email,
            fields: {
              UserID: user.id,
              WorkspaceID: user.workspaceID,
            },
          }),
          headers: { "Content-Type": "application/json" },
        },
      ).then(
        (res) =>
          res.json() as unknown as {
            id: string | null;
            error?: { code: string };
          },
      );
      log.info("response", response);
      return response;
    },
  );
}
