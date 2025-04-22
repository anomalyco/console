import { pgTable, varchar, integer, bigint } from "drizzle-orm/pg-core";
import { timestamps, workspaceID } from "../util/sql.pg";
import { workspaceIndexes } from "../workspace/workspace.pg";

export const agentUsageTable = pgTable(
  "agent_usage",
  {
    ...workspaceID,
    ...timestamps,
    requestID: varchar("request_id", { length: 255 }),
    model: varchar("model", { length: 255 }).notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cost: bigint("cost", { mode: "number" }).notNull(),
  },
  (table) => [...workspaceIndexes(table)],
);
