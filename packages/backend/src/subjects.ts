import { createSubjects } from "@openauthjs/openauth/subject";
import { z } from "zod";

export const subjects = createSubjects({
  account: z.object({
    accountID: z.string(),
    email: z.string(),
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
