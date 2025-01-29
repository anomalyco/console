import { createSubjects } from "@openauthjs/openauth/subject";
import { z } from "zod";

export const subjects = createSubjects({
  account: z.object({
    accountID: z.string(),
    email: z.string(),
  }),
});
