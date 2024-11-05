import { z } from "zod";
import { zod } from "../util/zod";

export { Account } from "./account";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { useWorkspace } from "../actor";
import { useTransaction } from "../util/transaction";
import { awsAccount } from "./aws.sql";
import { and, eq, sql } from "drizzle-orm";
import { RETRY_STRATEGY } from "../util/aws";

export * as AWS from ".";

const sts = new STSClient({
  retryStrategy: RETRY_STRATEGY,
});

export const assumeRole = zod(z.string(), async (id) => {
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
    console.log("failed to assume role", e);
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
});

export type Credentials = Exclude<
  Awaited<ReturnType<typeof assumeRole>>,
  undefined
>;
