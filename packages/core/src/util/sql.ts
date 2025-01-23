import { char, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
export { createId } from "@paralleldrive/cuid2";

export const cuid = (name: string) => char(name, { length: 24 });
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

export const timestamps = {
  timeCreated: timestamp("time_created", {
    mode: "string",
  })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  timeUpdated: timestamp("time_updated", {
    mode: "string",
  })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
  timeDeleted: timestamp("time_deleted", {
    mode: "string",
  }),
};

export const timestampsNext = {
  timeCreated: timestamp("time_created")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  timeUpdated: timestamp("time_updated")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
  timeDeleted: timestamp("time_deleted"),
};

import { customType } from "drizzle-orm/mysql-core";
import { gunzipSync, gzipSync } from "zlib";

export const blob = <TData>(name: string) =>
  customType<{ data: TData; driverData: string }>({
    dataType() {
      return "longtext";
    },
    fromDriver(value) {
      return JSON.parse(gunzipSync(Buffer.from(value, "binary")).toString());
    },
    toDriver(value: TData) {
      return gzipSync(Buffer.from(JSON.stringify(value))).toString("binary");
    },
  })(name);
