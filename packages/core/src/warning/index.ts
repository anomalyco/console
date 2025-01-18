export * as Warning from "./index";
import { warning } from "./warning.sql";
import { useTransaction } from "../util/transaction";
import { useWorkspace } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull } from "drizzle-orm";

export type Info = typeof warning.$inferSelect & Data;

type Data =
  | {
      type: "log_subscription";
      data:
        | {
            error: "limited" | "permissions" | "noisy";
          }
        | {
            error: "unknown";
            message: string;
          };
    }
  | {
      type: "issue_infra";
      data: {
        region: string;
        awsAccountID: string;
      };
    }
  | {
      type: "permission_usage";
      data: {};
    }
  | {
      type: "issue_rate_limited";
      data: {};
    }
  | {
      type: "issue_alert_slack";
      data: {
        channel: string;
      };
    };

export async function create(
  input: Data & { target: Info["target"]; stageID: Info["stageID"] },
) {
  await useTransaction(async (tx) =>
    tx
      .insert(warning)
      .values({
        id: createId(),
        stageID: input.stageID,
        workspaceID: useWorkspace(),
        type: input.type,
        target: input.target,
        data: input.data,
      })
      .onDuplicateKeyUpdate({
        set: {
          data: input.data,
        },
      })
      .execute(),
  );
}

export async function remove(input: Pick<Info, "type" | "stageID" | "target">) {
  await useTransaction((tx) =>
    tx
      .delete(warning)
      .where(
        and(
          eq(warning.workspaceID, useWorkspace()),
          input.stageID
            ? eq(warning.stageID, input.stageID)
            : isNull(warning.stageID),
          eq(warning.type, input.type),
          eq(warning.target, input.target),
        ),
      )
      .execute(),
  );
}

export async function forType(input: Pick<Info, "type" | "stageID">) {
  return useTransaction((tx) =>
    tx
      .select()
      .from(warning)
      .where(
        and(
          eq(warning.workspaceID, useWorkspace()),
          input.stageID
            ? eq(warning.stageID, input.stageID)
            : isNull(warning.stageID),
          eq(warning.type, input.type),
        ),
      )
      .execute(),
  );
}
