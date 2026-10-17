import { z } from "zod";

export const StageName = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9-]+$/);
