import { createSubjects } from "@openauthjs/openauth/subject";
import { z } from "zod";

export const subjects = createSubjects({
  account: z.object({
    accountID: z.string(),
    email: z.string(),
    // Optional for decoding old access tokens; mandatory for account refresh.
    authentication: z.enum(["email", "google", "impersonation"]).optional(),
    impersonation: z
      .object({
        accountID: z.string(),
        email: z.string(),
        workspaceID: z.string(),
        userID: z.string(),
      })
      .optional(),
  }),
  user: z.object({
    userID: z.string(),
    workspaceID: z.string(),
  }),
});
