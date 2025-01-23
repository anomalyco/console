export { createId } from "@paralleldrive/cuid2";
import { varchar, timestamp } from "drizzle-orm/pg-core";

export const cuid = (name: string) => varchar(name, { length: 24 });

export const id = {
  get id() {
    return cuid("id").primaryKey().notNull();
  },
};

export const workspaceID = {
  get id() {
    return cuid("id").notNull();
  },
  get workspaceID() {
    return cuid("workspace_id").notNull();
  },
};

export const utc = (name: string) =>
  timestamp(name, {
    withTimezone: true,
  });

export const timestamps = {
  timeCreated: utc("time_created").notNull().defaultNow(),
  timeDeleted: utc("time_deleted"),
};
