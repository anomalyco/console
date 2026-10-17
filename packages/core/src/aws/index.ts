import { z } from "zod";
import { zod } from "../util/zod";

export { Account } from "./account";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { assertActor, useWorkspace } from "../actor";
import { useTransaction } from "../util/transaction";
import { awsAccount } from "./aws.sql";
import { and, eq, isNull, sql } from "drizzle-orm";
import { RETRY_STRATEGY } from "../util/aws";
import { workspace } from "../workspace/workspace.sql";

export * as AWS from ".";

const sts = new STSClient({
  retryStrategy: RETRY_STRATEGY,
});

export const AccountID = z.string().regex(/^\d{12}$/);

export const assumeRole = zod(AccountID, async (id) => {
  const workspaceID = useWorkspace();
  const account = await useTransaction((tx) =>
    tx
      .select({ id: awsAccount.id })
      .from(awsAccount)
      .innerJoin(workspace, eq(workspace.id, awsAccount.workspaceID))
      .where(
        and(
          eq(awsAccount.accountID, id),
          eq(awsAccount.workspaceID, workspaceID),
          isNull(awsAccount.timeDeleted),
          isNull(workspace.timeDeleted),
        ),
      )
      .execute()
      .then((rows) => rows.at(0)),
  );
  if (!account) return;
  return requestRole(id);
});

// Only the CloudFormation connect verifier may assume a role before the
// account row exists. Never use this path for normal workspace operations.
export const assumeRoleForConnect = zod(AccountID, async (id) => {
  assertActor("system");
  const live = await useTransaction((tx) =>
    tx
      .select({ id: workspace.id })
      .from(workspace)
      .where(
        and(eq(workspace.id, useWorkspace()), isNull(workspace.timeDeleted)),
      )
      .execute()
      .then((rows) => rows.at(0)),
  );
  if (!live) return;
  return requestRole(id);
});

async function requestRole(id: string) {
  const workspaceID = useWorkspace();
  try {
    const result = await sts.send(
      new AssumeRoleCommand({
        RoleArn: `arn:aws:iam::${id}:role/sst-${workspaceID}`,
        RoleSessionName: "sst",
        ExternalId: workspaceID,
        DurationSeconds: 3600,
      }),
    );
    await useTransaction((tx) =>
      tx
        .update(awsAccount)
        .set({
          timeFailed: null,
        })
        .where(
          and(
            eq(awsAccount.accountID, id),
            eq(awsAccount.workspaceID, workspaceID),
          ),
        )
        .execute(),
    );
    return {
      secretAccessKey: result.Credentials!.SecretAccessKey!,
      accessKeyId: result.Credentials!.AccessKeyId!,
      sessionToken: result.Credentials!.SessionToken!,
    };
  } catch (e: any) {
    console.log("failed to assume role", {
      name: e.name,
      requestID: e.$metadata?.requestId,
    });
    if (e.name === "AccessDenied") {
      const r = await useTransaction((tx) =>
        tx
          .update(awsAccount)
          .set({
            timeFailed: sql`now()`,
          })
          .where(
            and(
              eq(awsAccount.accountID, id),
              eq(awsAccount.workspaceID, workspaceID),
            ),
          )
          .execute(),
      );
      return;
    }

    throw e;
  }
}

export type Credentials = Exclude<
  Awaited<ReturnType<typeof assumeRole>>,
  undefined
>;
