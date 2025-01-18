import { mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { id, timestamps } from "../util/sql";

export const account = mysqlTable(
  "account",
  {
    ...id,
    ...timestamps,
    email: varchar("email", { length: 255 }).notNull(),
  },
  (user) => ({
    email: uniqueIndex("email").on(user.email),
  }),
);
